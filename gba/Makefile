# Boogie Garanten – GBA-Version (Butano)
# Bauen:  ./hole_butano.sh  (einmalig)  und dann  make -j4
# Voraussetzung: devkitARM (oder das Docker-Image devkitpro/devkitarm) und python3
TARGET      	:=  boogie-garanten
BUILD       	:=  build
BUTANO      	:=  butano
LIBBUTANO   	:=  $(BUTANO)/butano
PYTHON      	:=  python3
SOURCES     	:=  src $(BUTANO)/common/src
INCLUDES    	:=  include $(BUTANO)/common/include
DATA        	:=
GRAPHICS    	:=  graphics $(BUTANO)/common/graphics
AUDIO       	:=  audio
AUDIOBACKEND	:=  maxmod
AUDIOTOOL		:=
DMGAUDIO    	:=  dmg_audio
DMGAUDIOBACKEND	:=  default
ROMTITLE    	:=  BOOGIEGARANT
ROMCODE     	:=  2BGD
# Kennung des Builds (git-Commit) für die Titelzeile; BG_EXTRA z. B. -DBG_BENCHMARK
BG_KENNUNG    	?=  $(shell git rev-parse --short HEAD 2>/dev/null || echo lokal)
USERFLAGS   	:=  -DBG_KENNUNG=\"$(BG_KENNUNG)\" $(BG_EXTRA)
USERCXXFLAGS	:=
USERASFLAGS 	:=
USERLDFLAGS 	:=
USERLIBDIRS 	:=
USERLIBS    	:=
DEFAULTLIBS 	:=
STACKTRACE		:=
USERBUILD   	:=
EXTTOOL     	:=

ifndef LIBBUTANOABS
	export LIBBUTANOABS	:=	$(realpath $(LIBBUTANO))
endif

ifeq ($(LIBBUTANOABS),)
$(error Butano fehlt: erst ./hole_butano.sh ausführen)
endif

include $(LIBBUTANOABS)/butano.mak
