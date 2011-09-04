SAMSF="http://samtools.svn.sourceforge.net/viewvc/samtools/trunk/samtools"
NODEDIR=${HOME}/tmp/NODEJS/node-v0.4.10/
CC=gcc
CPP=g++
CFLAG=-O2 -Wall -D_FILE_OFFSET_BITS=64 -D_LARGEFILE64_SOURCE -D_USE_KNETFILE
NODECFLAG=$(CFLAG) -g -fPIC -DPIC -D_LARGEFILE_SOURCE -D_GNU_SOURCE -DEV_MULTIPLICITY=0 -I${HOME}/tmp/NODEJS/include/node
WGET=wget -q


all:../build/bgzf.node

../build/bgzf.node:../build xbgzf.o libbgzf.a
	$(CPP) xbgzf.o libbgzf.a -o $@ -shared -lz
xbgzf.o:xbgzf.cpp bgzf.h knetfile.h
	$(CPP) -c -o $@ $< $(NODECFLAG)
libbgzf.a:bgzf.o  knetfile.o
	$(AR) -csru $@ bgzf.o  knetfile.o
bgzf.o:bgzf.c bgzf.h knetfile.h khash.h
	$(CC) -c -o $@ $(CFLAG) $<
bgzf.c:
	$(WGET) -O $@ "${SAMSF}/bgzf.c"
bgzf.h:
	$(WGET) -O $@ "${SAMSF}/bgzf.h"
khash.h:
	$(WGET) -O $@ "${SAMSF}/khash.h"
knetfile.o:knetfile.c knetfile.h
	$(CC) -c -o $@ $(CFLAG) $<
knetfile.h:
	$(WGET) -O $@ "${SAMSF}/knetfile.h"
knetfile.c:
	$(WGET) -O $@ "${SAMSF}/knetfile.c"
../build:
	mkdir $@
old:
	node-waf configure
	node-waf build
	node helloworld.js
clean:
	rm -f *.o *.a a.out 
clean-all:clean
	rm -f bgzf.c bgzf.h khash.h knetfile.h knetfile.c *.o *.a a.out


