// Spielszene der GBA-Version (Etappe 4): eine Bahn spielen – Abläufe wie in index.html
// (zielen, Kraft laden, Flug, Landung, OB, Mando, Putten), Grafik aus der Webversion.
//
// Steuerung:
//   ▲ ▼  zielen (Ziellinie hoch/runter, gehalten schneller)   ◀ ▶  Scheibe wählen
//   L / R  Abwurfwinkel Anhyzer / Hyzer     B    Vorhand / Rückhand (im Putt: Spin / Push)
//   A halten  Kraft laden, loslassen werfen (im Putt: A putten, wenn das Fadenkreuz auf den Ketten ist)
//   SELECT  Umsehen: Steuerkreuz schiebt die Kamera, A ganze Bahn, B/SELECT zurück
//           (im Putt-Modus: werfen statt putten)  START  zurück zur Bahnansicht

#include "spiel.h"

#include "bn_core.h"
#include "bn_keypad.h"
#include "bn_string.h"
#include "bn_vector.h"
#include "bn_optional.h"
#include "bn_math.h"
#include "bn_timer.h"
#include "bn_timers.h"
#include "bn_bg_palettes.h"
#include "bn_sprite_ptr.h"
#include "bn_sprite_text_generator.h"
#include "bn_palette_bitmap_bg_ptr.h"
#include "bn_palette_bitmap_bg_painter.h"
#include "bn_palette_bitmap_roi.h"

#include "bn_sprite_items_figuren.h"
#include "bn_sprite_items_korb.h"
#include "bn_sprite_items_balken.h"
#include "bn_sprite_items_kraftmarke.h"
#include "common_variable_8x8_sprite_font.h"

#include "physik.h"
#include "mathe.h"
#include "zufall.h"
#include "gen_bahnen.h"
#include "gen_taschen.h"
#include "gen_einstellungen.h"
#include "gen_bahn_bilder.h"

namespace
{
    // Bilder der Figuren (gba/graphics/figuren.bmp)
    enum figur { f_scheibe, f_schatten, f_punkt, f_punkt_gelb, f_spieler, f_fadenkreuz, f_korb, f_marke,
                 f_fadenkreuz_rot, f_putt_scheibe };

    // Putt-Nahansicht (gba/graphics/putt_ansicht.bmp aus zeichnePuttHintergrund in index.html):
    // Lage auf dem Bildschirm und Umrechnung der Web-Koordinaten (320 × 180, KETTEN = 160, 75)
    constexpr int putt_bild_x = (240 - gen::putt_breite) / 2, putt_bild_y = 4;
    constexpr int ketten_sx = putt_bild_x + gen::putt_ketten_x - 120, ketten_sy = putt_bild_y + gen::putt_ketten_y - 80;
    constexpr double web_kx = 160, web_ky = 75;

    constexpr int bild_breite = gen::bahn_bild_breite, bild_hoehe = gen::bahn_bild_hoehe;
    constexpr int schirm_breite = 240, schirm_hoehe = 160;
    constexpr int ziel_punkte = 11;

    BN_DATA_EWRAM_BSS physik::ergebnis flug_ergebnis;   // groß – nicht auf den Stack und nicht in den IWRAM

    double abstand(physik::punkt a, physik::punkt b) { return mathe::hypot(a.x - b.x, a.y - b.y); }

    // Richtung als Himmelsrichtung (Karte: Norden oben)
    const char* himmelsrichtung(double x, double y)
    {
        static const char* namen[] = { "O", "SO", "S", "SW", "W", "NW", "N", "NO" };
        double a = mathe::atan2(y, x);   // y nach unten = Süden
        int k = int(mathe::runde(a / (mathe::pi / 4)));
        return namen[(k + 8) % 8];
    }

    const char* typ_name(daten::scheiben_typ t)
    {
        switch(t)
        {
        case daten::scheiben_typ::driver: return "Driver";
        case daten::scheiben_typ::fairway: return "Fairway";
        case daten::scheiben_typ::midrange: return "Midrange";
        default: return "Putter";
        }
    }

    // Kraftbalken wie zeichneKraftbalken() in index.html: 12 Stücke à 8 Pixel, Mitte des Bildschirms
    constexpr int balken_stuecke = 12, balken_y = 60;

    // Tempo auf dem GBA: Flug und Kraftpendel langsamer als im Browser (dort 1,0); auf dem kleinen
    // Bildschirm wirkte die Browser-Geschwindigkeit zu hektisch
    constexpr double gba_tempo = 0.65;

    class spiel
    {
    public:
        spiel(int bahn_nr, int spieler_nr, unsigned startwert) :
            _b(gen::bahnen[bahn_nr]),
            _sp(gen::alle_spieler[spieler_nr]),
            _item(*gen::bahn_bilder[bahn_nr]),
            _bg(bn::palette_bitmap_bg_ptr::create(_item.palette_item())),
            _painter(_bg),
            _text(common::variable_8x8_sprite_font),
            _zz(startwert * 2654435761u + 12345u),
            _px_pro_m(double(bild_breite) / physik::zahl(_b.breite)),
            _schatten(bn::sprite_items::figuren.create_sprite(0, 0, f_schatten)),
            _scheibe(bn::sprite_items::figuren.create_sprite(0, 0, f_scheibe)),
            _spieler(bn::sprite_items::figuren.create_sprite(0, 0, f_spieler)),
            _korb(bn::sprite_items::figuren.create_sprite(0, 0, f_korb))
        {
            _bahn_nr = bahn_nr;
            bn::bg_palettes::set_transparent_color(bn::color(0, 0, 0));
            _schatten.set_z_order(2);
            _korb.set_z_order(1);
            _spieler.set_z_order(1);
            _scheibe.set_z_order(0);
            for(int i = 0; i < ziel_punkte; ++i)
            {
                bn::sprite_ptr p = bn::sprite_items::figuren.create_sprite(0, 0, i < 8 ? f_punkt : f_punkt_gelb);
                p.set_z_order(1);
                _ziel.push_back(bn::move(p));
            }

            // Wind wie neueRunde() in index.html: 1..6 m/s, beliebige Richtung
            const double st = 1 + zahl01() * 5, ri = zahl01() * mathe::pi * 2;
            _wind = { mathe::cos(ri) * st, mathe::sin(ri) * st };

            _lie = physik::zu_punkt(_b.abwurf);
            _scheibe_nr = start_scheibe();
            _vorhand = _sp.vorhand;
            naechster_zug();

            // Kamera sofort an die richtige Stelle
            kamera_ziel(_kam_x, _kam_y);
            _kam_x &= ~1;
            _blit = 2;
        }

        // Spielt die Bahn; true = fertig (im Korb), false = abgebrochen
        bool spielen()
        {
            while(true)
            {
                if(bn::keypad::start_pressed() && _zustand != zustand::flug) { return false; }
                if(! eingabe()) { return true; }
                bild();
            }
        }

        // Ein Bild zeichnen (auch aus der Physik-Rückmeldung heraus, während ein Wurf gerechnet wird)
        void bild()
        {
            ++_uhr_bilder;
            if(_zustand == zustand::laden)
            {
                // wie schleife() in index.html: Kraft pendelt in 1,1 s hoch und wieder herunter
                const double ph = mathe_mod(double(_uhr_bilder - _lade_start) / 60 * gba_tempo / 1.1, 2);
                _kraft = ph < 1 ? ph : 2 - ph;
            }
            if(_zustand == zustand::flug) { flug_weiter(); }

            const bool putt_bild = _zustand == zustand::putt;
            if(putt_bild != _zeigt_putt)
            {
                _zeigt_putt = putt_bild;
                _bg.set_palette(putt_bild ? gen::putt_ansicht.palette_item() : _item.palette_item());
                _blit = 2;
            }
            if(_zeigt_putt)
            {
                if(_blit > 0)
                {
                    _painter.clear();
                    _painter.unsafe_blit(putt_bild_x, putt_bild_y, bn::palette_bitmap_roi(gen::putt_ansicht.pixels_item(), 0, 0,
                                         gen::putt_breite, gen::putt_hoehe));
                    _painter.flip_page_later();
                    --_blit;
                }
            }
            else if(_uebersicht)
            {
                // ganze Bahn (Übersichtsbild 240 × 135), etwas nach unten gerückt
                if(_blit > 0)
                {
                    const bn::palette_bitmap_item& ue = *gen::uebersichten[_bahn_nr];
                    _painter.clear();
                    _painter.unsafe_blit(0, uebersicht_oben, bn::palette_bitmap_roi(ue.pixels_item(), 0, 0,
                                         gen::uebersicht_breite, gen::uebersicht_hoehe));
                    _painter.flip_page_later();
                    --_blit;
                }
            }
            else
            {
                // Kamera weich nachführen (x gerade, damit das Kopieren schnell bleibt)
                int zx, zy;
                kamera_ziel(zx, zy);
                int nx = _kam_x + (zx - _kam_x) / 6, ny = _kam_y + (zy - _kam_y) / 6;
                if(bn::abs(zx - _kam_x) < 6 || _umsehen) { nx = zx; }
                if(bn::abs(zy - _kam_y) < 6 || _umsehen) { ny = zy; }
                nx &= ~1;
                if(nx != _kam_x || ny != _kam_y) { _kam_x = nx; _kam_y = ny; _blit = 2; }
                if(_blit > 0)
                {
                    _painter.unsafe_blit(0, 0, bn::palette_bitmap_roi(_item.pixels_item(), _kam_x, _kam_y, schirm_breite, schirm_hoehe));
                    _painter.flip_page_later();
                    --_blit;
                }
            }

            figuren();
            texte();
            bn::core::update();
        }

    private:
        enum class zustand { zielen, laden, flug, pause, putt, fertig };

        const daten::bahn& _b;
        const daten::spieler& _sp;
        const bn::palette_bitmap_item& _item;
        bn::palette_bitmap_bg_ptr _bg;
        bn::palette_bitmap_bg_painter _painter;
        bn::sprite_text_generator _text;
        zufall _zz;                         // Zufall des Spiels (Wind, Böen, Putts); die Physik bekommt je Wurf eigenen
        zufall _wurf_zufall = zufall(1);
        double _px_pro_m;

        bn::sprite_ptr _schatten, _scheibe, _spieler, _korb;
        bn::vector<bn::sprite_ptr, ziel_punkte> _ziel;
        bn::vector<bn::sprite_ptr, 20> _zeile_oben, _zeile_zwei, _zeile_unten, _zeile_mitte;
        bn::vector<bn::sprite_ptr, balken_stuecke> _balken;
        bn::vector<bn::sprite_ptr, 6> _balken_text;
        bn::optional<bn::sprite_ptr> _kraftmarke;
        int _balken_stand[balken_stuecke] = {};
        int _banner_bis = 0;
        double _kraft_angezeigt = 0;   // Kraft des letzten Wurfs (für den Balken im Flug)
        bn::optional<bn::sprite_ptr> _fadenkreuz, _putt_scheibe;
        bool _zeigt_putt = false, _kreuz_gruen = true;
        bn::string<64> _text_oben, _text_zwei, _text_unten, _text_mitte;

        zustand _zustand = zustand::zielen;
        int _kam_x = 0, _kam_y = 0, _blit = 0;
        int _bahn_nr = 0;

        // Umsehen: Kamera frei schieben; Übersicht: ganze Bahn auf einem Bildschirm
        static constexpr int uebersicht_oben = 12;
        bool _umsehen = false, _uebersicht = false;
        int _frei_x = 0, _frei_y = 0, _halten_umsehen = 0;
        int _uhr_bilder = 0, _lade_start = 0, _pause_bis = 0, _halten_links = 0, _halten_rechts = 0;
        physik::punkt _lie;
        physik::wind _wind;
        int _wuerfe = 0, _scheibe_nr = 0, _winkel = 0;
        bool _vorhand = false, _mando_ok = false, _putt_modus = false, _push = false, _fertig_gemeldet = false;
        double _ziel_richtung = 0, _kraft = 0;

        // Flug
        double _flug_t = 0;
        bool _rechnet = false;
        physik::punkt _flug_pos = { 0, 0 };
        double _flug_z = 0;

        // Putt
        int _putt_start = 0;
        physik::punkt _putt_lie = { 0, 0 };
        const char* _putt_ergebnis = nullptr;
        double _putt_ox = 0, _putt_oy = 0;   // Fadenkreuz beim Putten (Web-Pixel um die Ketten)
        int _putt_flug_start = 0;

        double zahl01() { return _zz.naechste() / 4294967296.0; }

        static double mathe_mod(double a, double m)
        {
            return a - m * double(int(a / m));
        }

        const daten::scheibe& scheibe() const { return _sp.tasche[_scheibe_nr]; }

        int start_scheibe() const
        {
            if(_sp.lieblingsscheibe_index >= 0) { return _sp.lieblingsscheibe_index; }
            for(int k = 0; k < _sp.tasche_anzahl; ++k) { if(_sp.tasche[k].standard) { return k; } }
            return 0;
        }

        int putter() const
        {
            for(int k = 0; k < _sp.tasche_anzahl; ++k) { if(_sp.tasche[k].typ == daten::scheiben_typ::putter) { return k; } }
            return 0;
        }

        physik::punkt korb() const { return physik::zu_punkt(_b.korb); }
        double zum_korb() const { physik::punkt k = korb(); return mathe::atan2(k.y - _lie.y, k.x - _lie.x); }

        // Bildschirmposition (Butano: Mitte = 0, 0) eines Punktes in Metern
        // In der Übersicht ist das Bild kleiner (240 statt 512 Pixel breit) und beginnt bei Zeile uebersicht_oben
        double zoom() const { return _uebersicht ? double(gen::uebersicht_breite) / bild_breite : 1; }
        int kam_x() const { return _uebersicht ? 0 : _kam_x; }
        int kam_y() const { return _uebersicht ? -uebersicht_oben : _kam_y; }
        // Bildpunkt im großen Bahnbild → Bildschirm (Butano: Mitte = 0, 0)
        bn::fixed bx(double px) const { return bn::fixed(float(px * zoom())) - kam_x() - schirm_breite / 2; }
        bn::fixed by(double py) const { return bn::fixed(float(py * zoom())) - kam_y() - schirm_hoehe / 2; }
        bn::fixed sx(double x) const { return bx(x * _px_pro_m); }
        bn::fixed sy(double y) const { return by(y * _px_pro_m); }

        void kamera_ziel(int& x, int& y) const
        {
            if(_umsehen)
            {
                x = _frei_x;
                y = _frei_y;
                return;
            }
            double mx, my;
            if(_zustand == zustand::flug) { mx = _flug_pos.x; my = _flug_pos.y; }
            else if(_zustand == zustand::zielen || _zustand == zustand::laden)
            {
                // etwas in Wurfrichtung vorausschauen
                const double vor = mathe::min(abstand(_lie, korb()), 40) * 0.45;
                mx = _lie.x + mathe::cos(_ziel_richtung) * vor;
                my = _lie.y + mathe::sin(_ziel_richtung) * vor;
            }
            else { mx = _lie.x; my = _lie.y; }
            x = bn::max(0, bn::min(int(mx * _px_pro_m) - schirm_breite / 2, bild_breite - schirm_breite));
            y = bn::max(0, bn::min(int(my * _px_pro_m) - schirm_hoehe / 2, bild_hoehe - schirm_hoehe));
        }

        void naechster_zug()
        {
            _ziel_richtung = zum_korb();
            _winkel = 0;
            _kraft = 0;
            _putt_modus = abstand(_lie, korb()) <= 10;
            if(_putt_modus) { _scheibe_nr = putter(); }
            else { passe_scheibe_an(); }
            _zustand = _putt_modus ? zustand::putt : zustand::zielen;
            _putt_start = _uhr_bilder;
            _putt_ergebnis = nullptr;
        }

        // Passt die gewählte Scheibe nicht zur Entfernung (viel zu weit oder zu kurz), automatisch eine
        // passende nehmen – wie passeScheibeAn() in index.html
        void passe_scheibe_an()
        {
            const double d = abstand(_lie, korb());
            const double rw_akt = physik::reichweite(scheibe());
            if(d <= rw_akt * 1.0 && d >= rw_akt * 0.6) { return; }
            // am liebsten eine Scheibe, die die Strecke mit etwa 85 % Kraft schafft
            int best = _scheibe_nr;
            double note = 1e300;
            for(int i = 0; i < _sp.tasche_anzahl; ++i)
            {
                const daten::scheibe& x = _sp.tasche[i];
                const double r = physik::reichweite(x);
                const double n = mathe::betrag(r * 0.85 - d) + (r < d ? 1000 : 0) - (x.standard ? 6 : 0);
                if(n < note) { note = n; best = i; }
            }
            if(note >= 1000)
            {
                best = 0;
                for(int i = 1; i < _sp.tasche_anzahl; ++i)
                {
                    if(physik::reichweite(_sp.tasche[i]) > physik::reichweite(_sp.tasche[best])) { best = i; }
                }
            }
            if(best == _scheibe_nr) { return; }
            _scheibe_nr = best;
            bn::string<48> t;
            bn::ostringstream z(t);
            z.append(scheibe().name);
            z.append(" (");
            z.append(typ_name(scheibe().typ));
            z.append(")");
            melde(t, 96);   // 1,6 s
        }

        // Stärken wie staerke() in index.html (Wurfart, Hyzer/Anhyzer, S-Line, Lieblingsscheibe)
        void staerke(double& streuung, double& weite) const
        {
            streuung = 1;
            weite = 1;
            auto anwenden = [&](const daten::staerke& s)
            {
                if(s.gesetzt) { streuung *= physik::zahl(s.streuung); weite *= physik::zahl(s.weite); }
            };
            if(_scheibe_nr == _sp.lieblingsscheibe_index) { anwenden(_sp.lieblingsscheibe); }
            anwenden(_vorhand ? _sp.vorhand_staerke : _sp.rueckhand);
            if(_winkel < -2) { anwenden(_sp.anhyzer); }
            if(_winkel > 2) { anwenden(_sp.hyzer); }
            if(! _vorhand && (_winkel < -2 || (bn::abs(_winkel) <= 2 && physik::zahl(scheibe().turn) <= -2))) { anwenden(_sp.sline); }
        }

        // Böe wie boe() in index.html
        physik::wind boe()
        {
            const double f = 0.8 + zahl01() * 0.4, a = (zahl01() - 0.5) * 20 * physik::grad();
            return { (_wind.x * mathe::cos(a) - _wind.y * mathe::sin(a)) * f,
                     (_wind.x * mathe::sin(a) + _wind.y * mathe::cos(a)) * f };
        }

        // ---------- Eingabe; false = Bahn beendet ----------
        bool eingabe()
        {
            if(_umsehen)
            {
                umsehen();
                return true;
            }
            switch(_zustand)
            {
            case zustand::zielen:
            {
                // ▲ ▼: Ziellinie auf dem Bildschirm hoch/runter – erst fein (0,5°), gehalten 24°/s
                // (wie im Browser ~25°/s), lange gehalten 60°/s
                _halten_links = bn::keypad::up_held() ? _halten_links + 1 : 0;
                _halten_rechts = bn::keypad::down_held() ? _halten_rechts + 1 : 0;
                auto schritt = [](int h) { return h == 1 ? 0.5 : h > 18 ? (h > 75 ? 1.0 : 0.4) : 0.0; };
                // nach rechts geworfen: hoch = gegen den Uhrzeigersinn; nach links geworfen umgekehrt
                const double richtung = mathe::cos(_ziel_richtung) < 0 ? -1 : 1;
                _ziel_richtung += (schritt(_halten_rechts) - schritt(_halten_links)) * richtung * physik::grad();
                if(bn::keypad::left_pressed()) { _scheibe_nr = (_scheibe_nr + _sp.tasche_anzahl - 1) % _sp.tasche_anzahl; }
                if(bn::keypad::right_pressed()) { _scheibe_nr = (_scheibe_nr + 1) % _sp.tasche_anzahl; }
                if(bn::keypad::l_pressed()) { _winkel = bn::max(_winkel - 5, -30); }
                if(bn::keypad::r_pressed()) { _winkel = bn::min(_winkel + 5, 30); }
                if(bn::keypad::b_pressed()) { _vorhand = ! _vorhand; }
                if(bn::keypad::select_pressed()) { _umsehen = true; _frei_x = _kam_x; _frei_y = _kam_y; _halten_umsehen = 0; }
                if(bn::keypad::a_pressed()) { _zustand = zustand::laden; _lade_start = _uhr_bilder; _kraft = 0; }
                break;
            }
            case zustand::laden:
                if(! bn::keypad::a_held()) { werfen(); }
                break;
            case zustand::putt:
                if(_putt_ergebnis)
                {
                    if(_uhr_bilder >= _pause_bis) { putt_ende(); }
                    break;
                }
                if(bn::keypad::b_pressed()) { _push = ! _push; }
                if(bn::keypad::select_pressed()) { _putt_modus = false; _scheibe_nr = start_scheibe(); _zustand = zustand::zielen; }
                if(bn::keypad::a_pressed()) { putten(); }
                break;
            case zustand::flug:
                break;
            case zustand::pause:
                if(_uhr_bilder >= _pause_bis) { naechster_zug(); }
                break;
            case zustand::fertig:
                if(bn::keypad::a_pressed() || bn::keypad::start_pressed()) { return false; }
                break;
            }
            return true;
        }

        // ---------- Umsehen (wie "Umsehen" in index.html) ----------
        void umsehen()
        {
            if(bn::keypad::b_pressed() || bn::keypad::select_pressed())
            {
                _umsehen = false;
                if(_uebersicht) { _uebersicht = false; _bg.set_palette(_item.palette_item()); }
                _blit = 2;
                return;
            }
            if(bn::keypad::a_pressed())
            {
                _uebersicht = ! _uebersicht;
                _bg.set_palette(_uebersicht ? gen::uebersichten[_bahn_nr]->palette_item() : _item.palette_item());
                _blit = 2;
                return;
            }
            if(_uebersicht) { return; }
            const bool gedrueckt = bn::keypad::left_held() || bn::keypad::right_held() || bn::keypad::up_held() || bn::keypad::down_held();
            _halten_umsehen = gedrueckt ? _halten_umsehen + 1 : 0;
            const int tempo = _halten_umsehen > 20 ? 8 : 4;
            if(bn::keypad::left_held()) { _frei_x -= tempo; }
            if(bn::keypad::right_held()) { _frei_x += tempo; }
            if(bn::keypad::up_held()) { _frei_y -= tempo; }
            if(bn::keypad::down_held()) { _frei_y += tempo; }
            _frei_x = bn::max(0, bn::min(_frei_x, bild_breite - schirm_breite));
            _frei_y = bn::max(0, bn::min(_frei_y, bild_hoehe - schirm_hoehe));
        }

        // ---------- Wurf ----------
        static void rueckmeldung(const physik::ergebnis&, void* daten)
        {
            spiel& s = *static_cast<spiel*>(daten);
            static bn::timer seit;
            if(seit.elapsed_ticks() < bn::timers::ticks_per_frame() / 2) { return; }
            s.bild();
            seit.restart();
        }

        void werfen()
        {
            double streuung, weite;
            staerke(streuung, weite);
            physik::wurf w;
            w.x = _lie.x;
            w.y = _lie.y;
            w.richtung = _ziel_richtung;
            w.kraft = _kraft;
            _kraft_angezeigt = _kraft;
            w.winkel = _winkel;
            w.scheibe = &scheibe();
            w.links = _sp.linkshaender;
            w.vorhand = _vorhand;
            w.streu_faktor = streuung;
            w.weite_faktor = weite;
            w.mando_ok = _mando_ok;
            ++_wuerfe;

            _zustand = zustand::flug;
            _flug_t = 0;
            _flug_pos = _lie;
            _flug_z = 1.3;
            _rechnet = true;
            _wurf_zufall = zufall(_zz.naechste());
            physik::setze_zufall(_wurf_zufall);
            physik::setze_rueckruf(rueckmeldung, this);
            flug_ergebnis.pfad_laenge = 0;
            physik::wurf g = physik::streue(w);
            physik::simuliere(_b, g, boe(), flug_ergebnis);
            physik::setze_rueckruf(nullptr, nullptr);
            _rechnet = false;
        }

        // Flug-Animation: wie flugPosition() in index.html, Zeit läuft mit E.tempo
        void flug_weiter()
        {
            const physik::ergebnis& e = flug_ergebnis;
            const int fertig_bis = _rechnet ? e.pfad_laenge - 1 : e.pfad_laenge;   // endgültige Punkte
            if(fertig_bis < 2) { return; }
            const double t_neu = _flug_t + gen::einstellungen::tempo * gba_tempo / 60;
            // nicht über die schon gerechneten Punkte hinaus
            if(_rechnet && t_neu > e.pfad[fertig_bis - 1].t) { return; }
            _flug_t = t_neu;
            if(! _rechnet && _flug_t >= e.dauer)
            {
                const physik::pfadpunkt& p = e.pfad[e.pfad_laenge - 1];
                _flug_pos = { p.x, p.y };
                _flug_z = p.z;
                landung();
                return;
            }
            int i = 1;
            while(i < fertig_bis - 1 && e.pfad[i].t < _flug_t) { ++i; }
            const physik::pfadpunkt& a = e.pfad[i - 1];
            const physik::pfadpunkt& b = e.pfad[i];
            const double f = mathe::clamp((_flug_t - a.t) / mathe::max(1e-6, b.t - a.t), 0, 1);
            _flug_pos = { a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f };
            _flug_z = a.z + (b.z - a.z) * f;
        }

        // wie flugEnde() in index.html (ohne Freies Werfen)
        void landung()
        {
            const physik::ergebnis& e = flug_ergebnis;
            if(e.mando == physik::mando_ergebnis::ok || (e.mando == physik::mando_ergebnis::verpasst && _b.m.hat_dropzone)) { _mando_ok = true; }
            _lie = e.lie;
            _pause_bis = _uhr_bilder + 78;   // 1,3 s
            _zustand = zustand::pause;
            if(e.drin)
            {
                melde(e.art == physik::typ::bowling ? "STRIKE!" : "TREFFER!");
                bahn_geschafft();
            }
            else if(e.mando == physik::mando_ergebnis::verpasst) { ++_wuerfe; melde("MANDO VERPASST! +1"); }
            else if(e.ob) { ++_wuerfe; melde("OB! +1"); }
            else if(e.art == physik::typ::baum) { melde("BAUM!"); }
            else if(e.art == physik::typ::mauer) { melde("MAUER!"); }
            else
            {
                bn::string<24> t;
                bn::ostringstream z(t);
                z.append(int(e.distanz + 0.5));
                z.append(" m");
                melde(t);
            }
        }

        void melde(const bn::string_view& t, int bilder = 78)
        {
            _banner_bis = _uhr_bilder + bilder;
            _text_mitte = t;
            _zeile_mitte.clear();
            _text.set_center_alignment();
            _text.generate(0, -20, _text_mitte, _zeile_mitte);
            _text.set_left_alignment();
        }

        void bahn_geschafft()
        {
            _zustand = zustand::fertig;
            const int diff = _wuerfe - _b.par;
            bn::string<48> t;
            bn::ostringstream z(t);
            z.append(_wuerfe == 1 ? "ASS!  1 Wurf" : "Im Korb!  ");
            if(_wuerfe > 1) { z.append(_wuerfe); z.append(" Wuerfe"); }
            z.append("  (");
            if(diff == 0) { z.append("Par"); }
            else if(diff == -1) { z.append("Birdie"); }
            else if(diff == -2) { z.append("Eagle"); }
            else if(diff == 1) { z.append("Bogey"); }
            else { if(diff > 0) { z.append("+"); } z.append(diff); }
            z.append(")");
            _text_unten = t;
            _zeile_unten.clear();
            _text.generate(-114, 72, _text_unten, _zeile_unten);
            _text_oben = "A: weiter";
            _zeile_oben.clear();
            _text.generate(-114, -74, _text_oben, _zeile_oben);
        }

        // ---------- Putt (wie puttWackel/putten/puttLage in index.html) ----------
        struct versatz { double x, y; };

        versatz putt_wackel(double t) const
        {
            const double d = abstand(_lie, korb());
            const double stil = _push ? 0.65 : 1, gut = physik::zahl(_sp.putten);
            const double A = (1.5 + d * 2.1 * gut) * stil * (0.7 + 0.3 * mathe::sin(t * 0.9));
            const double w = 1 + d * 0.1;
            const double r = zum_korb();
            const double quer = _wind.x * -mathe::sin(r) + _wind.y * mathe::cos(r);
            const double drift = quer * 1.6 * gut * (_push ? 1.7 : 0.8) * (0.6 + 0.4 * mathe::sin(t * 0.7));
            return { A * mathe::sin(t * 2.3 * w) + A * 0.5 * mathe::sin(t * 3.9 * w + 1) + drift,
                     A * 0.75 * mathe::sin(t * 2.9 * w + 2) + A * 0.3 * mathe::sin(t * 5.1 * w) };
        }

        double putt_zeit() const { return double(_uhr_bilder - _putt_start) / 60; }

        void putten()
        {
            const versatz o = putt_wackel(putt_zeit());
            _putt_ox = o.x;
            _putt_oy = o.y;
            _putt_flug_start = _uhr_bilder;
            ++_wuerfe;
            const double ax = mathe::betrag(o.x), ay = mathe::betrag(o.y);
            constexpr double bx = 12, by = 9;   // KETTEN in index.html
            if(ax <= bx && ay <= by)
            {
                const bool innen = ax <= 7 && ay <= 5;
                _putt_ergebnis = (innen || zahl01() < 0.6) ? "drin" : "spit";
            }
            else if(o.y < -by) { _putt_ergebnis = "hoch"; }
            else if(o.y > by && ax < 16) { _putt_ergebnis = "kurz"; }
            else { _putt_ergebnis = "seite"; }

            const physik::punkt k = korb();
            const double r = zum_korb(), dx = mathe::cos(r), dy = mathe::sin(r), qx = -dy, qy = dx;
            const double weit = _push ? 0.55 : 1.5;
            physik::punkt p = k;
            const bn::string_view erg(_putt_ergebnis);
            if(erg == "hoch") { const double a = (1 + zahl01() * 3) * weit; p = { k.x + dx * a + qx * o.x * 0.08, k.y + dy * a + qy * o.x * 0.08 }; }
            else if(erg == "kurz") { const double a = 0.4 + zahl01() * 1.1; p = { k.x - dx * a, k.y - dy * a }; }
            else if(erg == "spit") { const double a = zahl01() * mathe::pi * 2, d = (0.6 + zahl01()) * weit; p = { k.x + mathe::cos(a) * d, k.y + mathe::sin(a) * d }; }
            else if(erg == "seite")
            {
                const double sg = o.x < 0 ? -1 : 1, a = (0.8 + zahl01() * 1.6) * weit, b = zahl01() * 2 * weit;
                p = { k.x + qx * sg * a + dx * b, k.y + qy * sg * a + dy * b };
            }
            if(erg != "drin" && physik::ist_ob(p, _b)) { p = { k.x - dx, k.y - dy }; }
            _putt_lie = p;
            _pause_bis = _uhr_bilder + 70;
            melde(erg == "drin" ? "DRIN!" : erg == "spit" ? "SPIT OUT!" : erg == "hoch" ? "ZU HOCH!" : erg == "kurz" ? "ZU KURZ!" : "DANEBEN!");
        }

        void putt_ende()
        {
            const bool drin = bn::string_view(_putt_ergebnis) == "drin";
            _putt_ergebnis = nullptr;
            if(drin) { _lie = korb(); bahn_geschafft(); return; }
            _lie = _putt_lie;
            _zeile_mitte.clear();
            naechster_zug();
        }

        // ---------- Anzeige ----------
        void figuren()
        {
            const bool im_putt = _zustand == zustand::putt;
            const physik::punkt k = korb();
            _korb.set_position(sx(k.x), sy(k.y));
            _spieler.set_position(sx(_lie.x) - 4, sy(_lie.y) - 4);
            _spieler.set_visible(_zustand != zustand::fertig && ! im_putt);
            _korb.set_visible(! im_putt);

            // Scheibe: in der Hand, im Flug (mit Höhe), liegend
            physik::punkt p = _zustand == zustand::flug ? _flug_pos : _lie;
            const double z = _zustand == zustand::flug ? _flug_z : 0;
            _schatten.set_position(sx(p.x), sy(p.y));
            _scheibe.set_position(sx(p.x), sy(p.y) - bn::fixed(float(z * _px_pro_m * zoom() * 0.6)) - 1);
            const bool scheibe_sichtbar = _zustand == zustand::flug || _zustand == zustand::pause;
            _schatten.set_visible(scheibe_sichtbar);
            _scheibe.set_visible(scheibe_sichtbar);

            // Ziellinie wie zeichneZiellinie(): Punkte in Wurfrichtung, gelb gebogen je nach Winkel
            const bool zielen = _zustand == zustand::zielen || _zustand == zustand::laden;
            const double x0 = _lie.x * _px_pro_m, y0 = _lie.y * _px_pro_m;
            const double c = mathe::cos(_ziel_richtung), s = mathe::sin(_ziel_richtung);
            const double hand = (_sp.linkshaender ? -1 : 1) * (_vorhand ? -1 : 1);
            const double kurve = -_winkel * hand * 0.9;
            for(int i = 0; i < ziel_punkte; ++i)
            {
                double px, py;
                if(i < 8)
                {
                    const double d = 10 + i * 10 * (_zustand == zustand::laden ? 0.4 + _kraft * 0.6 : 1);
                    px = x0 + c * d;
                    py = y0 + s * d;
                }
                else
                {
                    const double d = (i - 7) * 6, ex = x0 + c * 86, ey = y0 + s * 86;
                    const double a = _ziel_richtung + kurve * physik::grad() * (d / 20);
                    px = ex + mathe::cos(a) * d - s * kurve * d * d / 400;
                    py = ey + mathe::sin(a) * d + c * kurve * d * d / 400;
                }
                _ziel[i].set_position(bx(px), by(py));
                _ziel[i].set_visible(zielen);
            }

            // Putt-Nahansicht: Fadenkreuz wackelt um die Ketten, nach dem Putt fliegt die Scheibe
            // (wie zeichnePuttAnsicht in index.html; Koordinaten in Web-Pixeln, 1:1 auf dem GBA)
            if(im_putt)
            {
                if(! _fadenkreuz)
                {
                    _fadenkreuz = bn::sprite_items::figuren.create_sprite(0, 0, f_fadenkreuz);
                    _fadenkreuz->set_z_order(0);
                    _kreuz_gruen = true;
                    _putt_scheibe = bn::sprite_items::figuren.create_sprite(0, 0, f_putt_scheibe);
                    _putt_scheibe->set_z_order(0);
                }
                auto setze = [](bn::sprite_ptr& sp, double wx, double wy)
                {
                    sp.set_position(bn::fixed(float(wx - web_kx)) + ketten_sx, bn::fixed(float(wy - web_ky)) + ketten_sy);
                };
                if(! _putt_ergebnis)
                {
                    const versatz o = putt_wackel(putt_zeit());
                    const bool auf_ketten = mathe::betrag(o.x) <= 12 && mathe::betrag(o.y) <= 9;
                    if(auf_ketten != _kreuz_gruen)
                    {
                        _kreuz_gruen = auf_ketten;
                        _fadenkreuz->set_tiles(bn::sprite_items::figuren.tiles_item(), auf_ketten ? f_fadenkreuz : f_fadenkreuz_rot);
                    }
                    setze(*_fadenkreuz, web_kx + o.x, web_ky + o.y);
                    _fadenkreuz->set_visible(true);
                    _putt_scheibe->set_visible(false);
                }
                else
                {
                    _fadenkreuz->set_visible(false);
                    const double t = double(_uhr_bilder - _putt_flug_start) / 60 / 0.45;
                    const double zx = web_kx + _putt_ox, zy = web_ky + _putt_oy;
                    constexpr double start_y = 14 + 146 - 10;   // by + bh - 10
                    double x, y;
                    if(t < 1)
                    {
                        x = 160 + (zx - 160) * t;
                        y = start_y + (zy - start_y) * t - mathe::sin(mathe::pi * t) * 10;
                    }
                    else
                    {
                        const double t2 = mathe::min(1, (t - 1) * 1.6);
                        const bn::string_view erg(_putt_ergebnis);
                        x = zx;
                        const double boden = (erg == "drin" || (erg == "kurz" && mathe::betrag(_putt_ox) < 13)) ? web_ky + 12 : 14 + 104;
                        y = zy + (boden - zy) * t2;
                        if(erg == "hoch") { x = zx + t2 * 10; y = zy + (14 + 98 - zy) * t2; }
                    }
                    setze(*_putt_scheibe, x, y);
                    _putt_scheibe->set_visible(true);
                }
            }
            else
            {
                _fadenkreuz.reset();
                _putt_scheibe.reset();
            }
        }

        // Kraftbalken wie zeichneKraftbalken(): grün/gelb/rot nach Streuung (kleiner bei Stärken),
        // hell bis zur Kraft, weiße Marke; nicht im Putt-Modus
        void kraftbalken()
        {
            const bool zeigen = ! _umsehen && (_zustand == zustand::zielen || _zustand == zustand::laden || _zustand == zustand::flug);
            if(! zeigen)
            {
                _balken.clear();
                _balken_text.clear();
                _kraftmarke.reset();
                return;
            }
            if(_balken.empty())
            {
                for(int i = 0; i < balken_stuecke; ++i)
                {
                    _balken.push_back(bn::sprite_items::balken.create_sprite(-balken_stuecke * 4 + i * 8 + 4, balken_y, 0));
                    _balken_stand[i] = -1;
                }
                _text.set_right_alignment();
                _text.generate(-balken_stuecke * 4 - 4, balken_y, "KRAFT", _balken_text);
                _text.set_left_alignment();
                _text.generate(balken_stuecke * 4 + 4, balken_y, "STREUUNG", _balken_text);
                _kraftmarke = bn::sprite_items::kraftmarke.create_sprite(0, balken_y);
            }
            double streuung, weite;
            staerke(streuung, weite);
            const double sf = streuung * (_vorhand ? 1.2 : 1) * physik::E().streuung;
            const double gelb = mathe::max(0.5, mathe::min(0.93, 1 - 0.3 * sf));
            const double rot = mathe::max(0.75, mathe::min(0.97, 1 - 0.1 * sf));
            const bool mit_kraft = _zustand == zustand::laden || _zustand == zustand::flug;
            const double k = _zustand == zustand::laden ? _kraft : _kraft_angezeigt;
            for(int i = 0; i < balken_stuecke; ++i)
            {
                const double p = (i + 0.5) / balken_stuecke;
                int f = p < gelb ? 0 : p < rot ? 1 : 2;
                if(mit_kraft && p < k) { f += 3; }   // hell bis zur Kraft
                if(f != _balken_stand[i])
                {
                    _balken_stand[i] = f;
                    _balken[i].set_tiles(bn::sprite_items::balken.tiles_item(), f);
                }
            }
            _kraftmarke->set_visible(mit_kraft);
            _kraftmarke->set_x(bn::fixed(float(-balken_stuecke * 4 + balken_stuecke * 8 * mathe::min(1, k))));
        }

        void setze_text(bn::string<64>& alt, const bn::string<64>& neu, bn::vector<bn::sprite_ptr, 20>& sprites, int y)
        {
            if(alt == neu) { return; }
            alt = neu;
            sprites.clear();
            _text.set_left_alignment();
            _text.generate(-114, y, alt, sprites);
        }

        void texte()
        {
            if(_zustand == zustand::fertig) { return; }
            const physik::punkt k = korb();
            const daten::scheibe& sc = scheibe();
            bn::string<64> oben;
            {
                bn::ostringstream z(oben);
                if(_b.name[0]) { z.append(_b.name); }
                else { z.append("Bahn "); z.append(int(_b.nummer)); }
                z.append("   Par ");
                z.append(int(_b.par));
                z.append("   Wurf ");
                z.append(_wuerfe + 1);
                z.append("   noch ");
                z.append(int(abstand(_lie, k) + 0.5));
                z.append(" m");
            }
            bn::string<64> zwei;
            {
                bn::ostringstream z(zwei);
                z.append("Wind ");
                z.append(int(mathe::hypot(_wind.x, _wind.y) + 0.5));
                z.append(" m/s ");
                z.append(himmelsrichtung(_wind.x, _wind.y));
                if(_zustand != zustand::putt)
                {
                    z.append("   ");
                    z.append(_vorhand ? "Vorhand" : "Rueckhand");
                    if(_winkel > 0) { z.append(", Hyzer "); z.append(_winkel); }
                    else if(_winkel < 0) { z.append(", Anhyzer "); z.append(-_winkel); }
                    else { z.append(", flach"); }
                }
            }
            bn::string<64> unten;
            {
                bn::ostringstream z(unten);
                if(_umsehen)
                {
                    z.append(_uebersicht ? "GANZE BAHN   A: schieben   B: zurueck" : "UMSEHEN: Steuerkreuz   A: ganze Bahn   B: zurueck");
                }
                else if(_zustand == zustand::putt)
                {
                    z.append(_push ? "PUTT Push" : "PUTT Spin");
                    z.append("  A: putten  B: Stil  SEL: werfen");
                }
                else
                {
                    // wie im Browser: Name (Typ) und Flugzahlen Speed | Glide | Turn | Fade
                    z.append(sc.name);
                    z.append(" (");
                    z.append(typ_name(sc.typ));
                    z.append(")   ");
                    z.append(int(physik::zahl(sc.speed)));
                    z.append(" | ");
                    z.append(int(physik::zahl(sc.glide)));
                    z.append(" | ");
                    z.append(int(physik::zahl(sc.turn)));
                    z.append(" | ");
                    z.append(int(physik::zahl(sc.fade)));
                }
            }
            setze_text(_text_oben, oben, _zeile_oben, -74);
            setze_text(_text_zwei, zwei, _zeile_zwei, -64);
            setze_text(_text_unten, unten, _zeile_unten, 72);
            if(_text_mitte.size() && _uhr_bilder >= _banner_bis && (_zustand == zustand::zielen || _zustand == zustand::putt)
               && ! (_zustand == zustand::putt && _putt_ergebnis))
            {
                _text_mitte.clear();
                _zeile_mitte.clear();
            }
            kraftbalken();
        }
    };
}

void szene_spiel(int bahn_nr, int spieler_nr, unsigned startwert)
{
    spiel s(bahn_nr, spieler_nr, startwert);
    bn::core::update();   // damit der START-Druck, der hierher geführt hat, nicht sofort zurückführt
    s.spielen();
}
