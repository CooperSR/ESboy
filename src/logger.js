import config from './config';
import Utils from './utils';

export default class Logger {

  static state(cpu, fn, paramLength, param){
    if (config.DEBUG) {
      console.info(`[${Utils.hex4(cpu.pc() - paramLength - 1)}] ${fn.name} ${Utils.hexStr(param)} Z:${cpu.Z()} N:${cpu.N()} H:${cpu.H()} C:${cpu.C()}  a:${Utils.hex2(cpu.a())} bc:${Utils.hex4(cpu.bc())} de:${Utils.hex4(cpu.de())} hl:${Utils.hex4(cpu.hl())} sp:${Utils.hex4(cpu.sp())} pc:${Utils.hex4(cpu.pc())}`);
    }
  }

  static info(msg){
    if (config.DEBUG) {
      console.info(msg);
    }
  }

  static error(msg){
    if (!config.TEST) {
      console.error(msg);
    }
  }
}