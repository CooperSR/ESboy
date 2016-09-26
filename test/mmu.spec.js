import MMU from '../src/mmu';
import Loader from '../src/loader';
import assert from 'assert';
import config from '../src/config';
import {describe, beforeEach, it} from 'mocha';
import fs from 'fs';

describe('MMU', () => {

  config.DEBUG = false;
  config.TEST = true;

  let mmu;

  beforeEach( () => {
    const loader = new Loader('./roms/blargg_cpu_instrs.gb');
    mmu = new MMU(loader.asUint8Array());
  });

  it('should handle missing ROM', () => {
    assert.throws(() => new MMU(), Error, 'Missing ROM');
  });

  it('should write bytes in memory', () => {
    mmu.writeByteAt(0xc000, 0xab);
    assert.equal(mmu.readByteAt(0xc000), 0xab, 'write 0xab in memory address 0xc000');
  });

  it('should write in Interrupt Enable register', () => {
    mmu.writeByteAt(0xffff, 0x0f);
    assert.equal(mmu.ie(), 0x0f, 'should write on 0xffff');
  });

  it('should not write bytes in ROM', () => {
    
    let addr = 0x0000;

    assert.doesNotThrow( () => {
      mmu.writeByteAt(addr, 0xab);
    }, Error, `should not write on ${addr}`);

    addr = 0x7fff;

    assert.doesNotThrow( () => {
      mmu.writeByteAt(addr, 0xab);
    }, Error, `should not write on ${addr}`);

    addr = 0x8000;

    mmu.writeByteAt(addr, 0xab);

    assert.equal(mmu.readByteAt(addr), 0xab, `can write on ${addr}`);
  });

  it('should start the memory map', () => {

    assert.equal(mmu._memory.length, 0x10000, 'Memory size is 0x10000');

    // Starting values at addresses
    assert.equal(mmu.readByteAt(0xff10), 0x80);
    assert.equal(mmu.readByteAt(0xff14), 0xbf);
    assert.equal(mmu.readByteAt(0xff16), 0x3f);
    assert.equal(mmu.readByteAt(0xff17), 0x00);
    assert.equal(mmu.readByteAt(0xff19), 0xbf);
    assert.equal(mmu.readByteAt(0xff1a), 0x7f);
    assert.equal(mmu.readByteAt(0xff1b), 0xff);
    assert.equal(mmu.readByteAt(0xff1c), 0x9f);
    assert.equal(mmu.readByteAt(0xff1e), 0xbf);
    assert.equal(mmu.readByteAt(0xff20), 0xff);
    assert.equal(mmu.readByteAt(0xff21), 0x00);
    assert.equal(mmu.readByteAt(0xff22), 0x00);
    assert.equal(mmu.readByteAt(0xff23), 0xbf);
    assert.equal(mmu.readByteAt(mmu.ADDR_IE), 0x01); // Allow vblank
  });

  it('should load the BIOS in memory', () => {
    assert.deepEqual(mmu.readBIOSBuffer(), mmu.getBIOS(), 'BIOS is in memory');
  });

  it('should read BIOS', () => {
    assert.equal(mmu.readByteAt(0x0000), 0x31, 'first BIOS byte');
    assert.equal(mmu.readByteAt(0x00ff), 0x50, 'last BIOS byte');
    assert.equal(mmu.readByteAt(0x0100), 0x00, 'first GAME byte');
    assert.equal(mmu.readByteAt(0x0101), 0xc3, 'second GAME byte');
  });

  describe('ROM checks', () => {

    it('should read the game header', () => {
      assert.equal(mmu.getGameTitle(), 'CPU_INSTRS', 'should read title');
      assert.equal(mmu.isGameInColor(), true, 'is gb color');
      assert.equal(mmu.isGameSuperGB(), false, 'should not be super GB');
      assert.equal(mmu.getCartridgeType(), 'ROM+MBC1');
      assert.equal(mmu.getRomSize(), '64KB');
      assert.equal(mmu.getRAMSize(), 'None');
      assert.equal(mmu.getDestinationCode(), 'Japanese');
    });

    it('should read the nintendo graphic buffer', () => {
      const u8array = new Uint8Array([0xCE,0xED,0x66,0x66,0xCC,0x0D,0x00,0x0B,0x03,0x73,0x00,0x83,0x00,0x0C,0x00,0x0D,0x00,0x08,0x11,0x1F,0x88,0x89,0x00,0x0E,0xDC,0xCC,0x6E,0xE6,0xDD,0xDD,0xD9,0x99,0xBB,0xBB,0x67,0x63,0x6E,0x0E,0xEC,0xCC,0xDD,0xDC,0x99,0x9F,0xBB,0xB9,0x33,0x3E]);
      assert.deepEqual(mmu.getNintendoGraphicBuffer(), u8array, 'Nintendo Graphic Buffer must match.');
    });

    it('should compute the checksum', () => {
      assert(mmu.isChecksumCorrect());
    });

  });

  describe('LY Register', () => {

    it('should write ly', () => {
      mmu.setLy(0x01);
      assert.equal(mmu.ly(), 0x01, 'set ly');
    });

    it('should increment ly', () => {
      mmu.setLy(0);
      mmu.incrementLy();
      mmu.incrementLy();
      assert.equal(mmu.ly(), 2, 'LY incremented one');
    });

    it('should restart ly', () => {
      mmu.setLy(153);

      mmu.incrementLy();

      assert.equal(mmu.ly(), 0, 'LY reset');
    });

  });

  describe('LCD Control Register', () => {

    it('should read/write lcdc', () => {
      mmu.writeByteAt(mmu.ADDR_LCDC, 0x80);
      assert.equal(mmu.lcdc(), 0x80, 'LCD on');
    });

    it('should ignore window as it is unsupported', () => {
      assert.throws( () => {
        mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() | mmu.MASK_WINDOW_ON);
      }, Error, 'Window unsupported');
    });

    it('should read character data 0x8000-0x8fff based on LCDC bit 4', () => {
      const chrData = new Uint8Array([0xab,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0xcd]);
      mmu.writeBuffer(chrData, 0x8000);

      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() | mmu.MASK_BG_CHAR_DATA_8000 | mmu.MASK_BG_ON);
      
      assert.deepEqual(mmu.readTile(0), chrData, 'Character data matches');
    });

    it('should read character data 0x8800-0x97ff based on LCDC bit 4', () => {
      const chrData = new Uint8Array([0xab,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0xcd]);
      mmu.writeBuffer(chrData, 0x8800);

      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() & mmu.MASK_BG_CHAR_DATA_8800 | mmu.MASK_BG_ON);

      assert.deepEqual(mmu.readTile(0), chrData, 'Character data matches');
    });

    it('should read character code from 0x9800 based on LCDC bit 3', () => {
      mmu.writeByteAt(0x9800, 0xab);
      mmu.writeByteAt(0x9bff, 0xcd);
      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() & mmu.MASK_BG_CODE_AREA_1);

      assert.equal(mmu.getCharCode(0, 0), 0xab, 'Block 0');
      assert.equal(mmu.getCharCode(31, 31), 0xcd, 'Block 1023');
    });

    it('should read character code from 0x9c00 based on LCDC bit 3', () => {
      mmu.writeByteAt(0x9c00, 0xab);
      mmu.writeByteAt(0x9fff, 0xcd);
      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() | mmu.MASK_BG_CODE_AREA_2);

      assert.equal(mmu.getCharCode(0, 0), 0xab, 'Block 0');
      assert.equal(mmu.getCharCode(31, 31), 0xcd, 'Block 1023');
    });

    it('should detect OBJ 8x16 as unsupported', () => {
      assert.throws( () => mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() | mmu.MASK_OBJ_8x16), Error, '8x16 OBJ unsupported');
    });

    it('should enable OBJ based on LCDC bit 1', () => {
      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() | mmu.MASK_OBJ_ON);
      assert(mmu.areOBJOn());
      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() & mmu.MASK_OBJ_OFF);
      assert(!mmu.areOBJOn());
    });

    it('should turn on/off background', () => {
      const chrData = new Uint8Array([0xab,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0xcd]);
      mmu.writeBuffer(chrData, 0x8000);
      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() | mmu.MASK_BG_ON | mmu.MASK_BG_CHAR_DATA_8000);

      assert.deepEqual(mmu.readTile(0), chrData, 'Character data matches');

      mmu.writeByteAt(mmu.ADDR_LCDC, mmu.lcdc() & mmu.MASK_BG_OFF);

      assert.deepEqual(mmu.readTile(0), new Uint8Array([0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00]), 'Transparent');
    });

  });

  describe('STAT or LCDC Status Flag', () => {
    it('should read/write STAT', () => {
      mmu.writeByteAt(mmu.ADDR_STAT, 0x00);
      assert.equal(mmu.stat(), 0x80, 'STAT.7 always set');

      mmu.writeByteAt(mmu.ADDR_STAT, 0xff);
      assert.equal(mmu.stat(), 0xff, 'STAT set');
    });

    it('should handle VRAM and OAM restrictions', () => {

      mmu.setLCDMode(2);
      assert.throws( () => mmu.writeByteAt(mmu.ADDR_OAM_START, 0x00), Error, 'Cannot write OAM on mode 2');
      assert.throws( () => mmu.readByteAt(mmu.ADDR_OAM_START), Error, 'Cannot read OAM on mode 2');

      mmu.setLCDMode(3);
      assert.throws( () => mmu.writeByteAt(mmu.ADDR_OAM_START, 0x00), Error, 'Cannot write OAM on mode 3');
      assert.throws( () => mmu.readByteAt(mmu.ADDR_OAM_START), Error, 'Cannot read OAM on mode 3');
      assert.throws( () => mmu.writeByteAt(mmu.ADDR_VRAM_START, 0x00), Error, 'Cannot write VRAM on mode 3');
      assert.throws( () => mmu.readByteAt(mmu.ADDR_VRAM_START), Error, 'Cannot read VRAM on mode 3');
    });

  });

  describe('OBJ (Sprites)', () => {
    it('should read OBJs', () => {

      mmu.writeByteAt(mmu.ADDR_OAM_START, 0x01);
      mmu.writeByteAt(mmu.ADDR_OAM_START + 1, 0x02);
      mmu.writeByteAt(mmu.ADDR_OAM_START + 2, 0xab);
      mmu.writeByteAt(mmu.ADDR_OAM_START + 3, 0b00000000);

      const {y, x, chrCode, attr} = mmu.getOBJ(0);

      assert.equal(y, 0x01);
      assert.equal(x, 0x02);
      assert.equal(chrCode, 0xab);
      assert.equal(attr, 0x00);
    });

    it('should not allow reading object 40', () => {
      assert.throws( () => this.mmu.getOBJ(-1), Error, '-1 out of range');
      assert.throws( () => this.mmu.getOBJ(40), Error, '40 out of range');
    });
  });
  
  describe('Joypad', () => {
    it('should return all high by default', () => {
      assert.equal(mmu.p1(), 0xff, 'Default');
    });

    it('should select arrows by setting P14 low', () =>{

      mmu.pressRight();
      mmu.writeByteAt(mmu.ADDR_P1, 0x20);
      assert.equal(mmu.p1(), 0b11101110, 'Right pressed');

      mmu.liftRight();
      mmu.writeByteAt(mmu.ADDR_P1, 0x20);
      assert.equal(mmu.p1(), 0b11101111, 'Right lifted');

      mmu.pressLeft();
      mmu.writeByteAt(mmu.ADDR_P1, 0x20);
      assert.equal(mmu.p1(), 0b11101101, 'Left pressed');

      mmu.liftLeft();
      mmu.writeByteAt(mmu.ADDR_P1, 0x20);
      assert.equal(mmu.p1(), 0b11101111, 'Left lifted');

      mmu.pressUp();
      mmu.writeByteAt(mmu.ADDR_P1, 0x20);
      assert.equal(mmu.p1(), 0b11101011, 'Up pressed');

      mmu.liftUp();
      mmu.writeByteAt(mmu.ADDR_P1, 0x20);
      assert.equal(mmu.p1(), 0b11101111, 'Up lifted');

      mmu.pressDown();
      mmu.writeByteAt(mmu.ADDR_P1, 0x20);
      assert.equal(mmu.p1(), 0b11100111, 'Down pressed');

      mmu.liftDown();
      mmu.writeByteAt(mmu.ADDR_P1, 0x20);
      assert.equal(mmu.p1(), 0b11101111, 'Down lifted');
    });

    it('should select buttons by setting P15 low', () =>{

      mmu.pressA();
      mmu.writeByteAt(mmu.ADDR_P1, 0x10);
      assert.equal(mmu.p1(), 0b11011110, 'A pressed');

      mmu.liftA();
      mmu.writeByteAt(mmu.ADDR_P1, 0x10);
      assert.equal(mmu.p1(), 0b11011111, 'A lifted');

      mmu.pressB();
      mmu.writeByteAt(mmu.ADDR_P1, 0x10);
      assert.equal(mmu.p1(), 0b11011101, 'B pressed');

      mmu.liftB();
      mmu.writeByteAt(mmu.ADDR_P1, 0x10);
      assert.equal(mmu.p1(), 0b11011111, 'B lifted');

      mmu.pressSELECT();
      mmu.writeByteAt(mmu.ADDR_P1, 0x10);
      assert.equal(mmu.p1(), 0b11011011, 'SELECT pressed');

      mmu.liftSELECT();
      mmu.writeByteAt(mmu.ADDR_P1, 0x10);
      assert.equal(mmu.p1(), 0b11011111, 'SELECT pressed');

      mmu.pressSTART();
      mmu.writeByteAt(mmu.ADDR_P1, 0x10);
      assert.equal(mmu.p1(), 0b11010111, 'START pressed');

      mmu.liftSTART();
      mmu.writeByteAt(mmu.ADDR_P1, 0x10);
      assert.equal(mmu.p1(), 0b11011111, 'START lifted');
    });

    it('should detect buttons and arrows at the same bit position', () => {
      mmu.pressRight();

      mmu.writeByteAt(mmu.ADDR_P1, 0x20);
      assert.equal(mmu.p1(), 0b11101110, 'Right pressed');

      mmu.writeByteAt(mmu.ADDR_P1, 0x10);
      assert.equal(mmu.p1(), 0b11011111, 'A is not pressed');

      mmu.writeByteAt(mmu.ADDR_P1, 0x20);
      assert.equal(mmu.p1(), 0b11101110, 'Right keeps pressed');
    });

    it('should reset', () => {
      mmu.writeByteAt(mmu.ADDR_P1, 0x30);
      assert.equal(mmu.p1(), 0xff, 'Default');
    });
  });

  describe('Interruptions', () => {

    it('should read/write the interrupt enable register', () => {
      mmu.setIe(0x01);
      assert.equal(mmu.ie(), 0x01);
    });

    it('should read/write the interrupt request register', () => {
      mmu.setIf(0x01);
      assert.equal(mmu.If(), 0x01);
    });
  });

  describe('DMA', () => {

    it('should not allow DMA from ROM area', () => {
      assert.throws( () => {
        mmu.writeByteAt(mmu.ADDR_DMA, mmu.ADDR_ROM_MAX >> 8);
      }, Error, 'No DMA allowed from ROM area');
    });

    it('should run DMA', () => {

      for(let i = 0; i < mmu.DMA_LENGTH; i++){
        mmu.writeByteAt(mmu.ADDR_WORKING_RAM + i, 0xaa);
      }

      mmu.writeByteAt(mmu.ADDR_DMA, mmu.ADDR_WORKING_RAM >> 8); // 0xc0

      assert.throws( () => {
        mmu.readByteAt(mmu.ADDR_OAM_START);
      }, Error, 'Cannot access OAM until DMA completes');

      mmu.setDMA(false); // Mock DMA end

      for(let i = 0; i < mmu.DMA_LENGTH; i++){
        assert.equal(mmu.readByteAt(mmu.ADDR_OAM_START + i), 0xaa);
      }
    });

  });

  describe('Serial Cable Communication', () => {
    it('should detect serial communication', () => {
      assert.throws( () => mmu.readByteAt(mmu.ADDR_SB), Error, 'SB register unsupported');
      assert.throws( () => mmu.readByteAt(mmu.ADDR_SC), Error, 'SC register unsupported');
    });
  });

  describe('Bank Registers (CGB only)', () => {
    it('should detect bank register', () => {
      assert.throws(() => mmu.readByteAt(mmu.ADDR_SVBK), Error, 'SVBK register unsupported');
      assert.throws(() => mmu.readByteAt(mmu.ADDR_KEY1), Error, 'KEY1 unsupported');
    });

    it('should not write VBK in DMG mode', () => {
      assert.equal(mmu.vbk(), 0, 'VBK always zero in DMG');
      mmu.writeByteAt(mmu.ADDR_VBK, 0xab);
      assert.equal(mmu.vbk(), 0, 'VBK always zero in DMG');
    });
  });

  describe('Timers', () => {
    it('should detect timers', () => {
      assert.throws( () => mmu.readByteAt(mmu.ADDR_TIMA), Error, 'TIMA register unsupported');
      assert.throws( () => mmu.readByteAt(mmu.ADDR_TMA), Error, 'TMA register unsupported');
      assert.throws( () => mmu.readByteAt(mmu.ADDR_TAC), Error, 'TAC register unsupported');
    });
  });

  describe('Dividers', () => {
    it('should detect dividers', () => {
      assert.throws( () => mmu.readByteAt(mmu.ADDR_DIV), Error, 'DIV register unsupported');
    });
  });

  describe('Memory dumps', () => {

    it('should dump a memory snapshot', () => {
      const filename = mmu.dumpMemoryToFile(); // TODO: mock fs in tests
      assert.doesNotThrow( () => {
          fs.accessSync(filename);
      });
      fs.unlinkSync(filename);

    });
  });

});