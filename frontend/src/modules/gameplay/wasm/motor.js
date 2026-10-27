let wasm;

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}
/**
 * O tempo arredondado para a grade da partida (1 ms).
 * @param {number} tempo
 * @returns {number}
 */
export function quantizar(tempo) {
    const ret = wasm.quantizar(tempo);
    return ret;
}

/**
 * 0 é perfeito, 1 ótimo e 2 bom.
 * @param {number} distancia
 * @returns {number}
 */
export function julgar(distancia) {
    const ret = wasm.julgar(distancia);
    return ret;
}

/**
 * @returns {number}
 */
export function janela_de_acerto() {
    const ret = wasm.janela_de_acerto();
    return ret;
}

let cachedFloat64ArrayMemory0 = null;

function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}
/**
 * As velocidades da música que o jogo oferece.
 * @returns {Float64Array}
 */
export function velocidades() {
    const ret = wasm.velocidades();
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

let WASM_VECTOR_LEN = 0;

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

let cachedUint32ArrayMemory0 = null;

function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

const MotorDaPartidaFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_motordapartida_free(ptr >>> 0, 1));

export class MotorDaPartida {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MotorDaPartidaFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_motordapartida_free(ptr, 0);
    }
    /**
     * O que mudou desde a última chamada, na ordem:
     * - 17 números do estado: tempo (NaN antes de começar), pontos, sequência, maior sequência, acertos,
     *   perfeitos, ótimos, bons, valor dos acertos, erros, vida, ticks de star power, barra de star power (0 a 1),
     *   star power ativo, derrota, fantasma e a primeira nota que ainda importa;
     * - quantas notas mudaram e, para cada uma, índice, bandeiras e até onde o sustain rendeu;
     * - quantos eventos e, para cada um, código e dois valores;
     * - quantas frases falharam e cada uma.
     * @returns {Float64Array}
     */
    sincronizar() {
        const ret = wasm.motordapartida_sincronizar(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * @returns {number}
     */
    multiplicador() {
        const ret = wasm.motordapartida_multiplicador(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    ativar_estrela() {
        const ret = wasm.motordapartida_ativar_estrela(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Tempo e duração de cada nota já no tempo real (dividido pela velocidade) e na grade da partida,
     * e a pista em que ela de fato cai (sem a aberta, a aberta vira verde), para o espelho começar igual.
     * @returns {Float64Array}
     */
    grade_das_notas() {
        const ret = wasm.motordapartida_grade_das_notas(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * As notas vêm em quatro listas paralelas, que passam para o WASM sem um objeto por nota.
     * @param {Float64Array} tempos
     * @param {Uint8Array} pistas
     * @param {Int32Array} frases
     * @param {Float64Array} duracoes
     * @param {boolean} sem_falha
     * @param {boolean} fantasma
     * @param {number} velocidade
     * @param {boolean} sem_aberta
     */
    constructor(tempos, pistas, frases, duracoes, sem_falha, fantasma, velocidade, sem_aberta) {
        const ptr0 = passArrayF64ToWasm0(tempos, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(pistas, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray32ToWasm0(frases, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArrayF64ToWasm0(duracoes, wasm.__wbindgen_malloc);
        const len3 = WASM_VECTOR_LEN;
        const ret = wasm.motordapartida_new(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, sem_falha, fantasma, velocidade, sem_aberta);
        this.__wbg_ptr = ret >>> 0;
        MotorDaPartidaFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} pista
     * @param {number} tempo
     * @returns {boolean}
     */
    tocar(pista, tempo) {
        const ret = wasm.motordapartida_tocar(this.__wbg_ptr, pista, tempo);
        return ret !== 0;
    }
    /**
     * @param {number} pista
     * @param {number} tempo
     */
    soltar(pista, tempo) {
        wasm.motordapartida_soltar(this.__wbg_ptr, pista, tempo);
    }
    /**
     * @param {number} indice
     * @param {number} tempo
     */
    acertar(indice, tempo) {
        wasm.motordapartida_acertar(this.__wbg_ptr, indice, tempo);
    }
    /**
     * @param {number} tempo
     */
    avancar(tempo) {
        wasm.motordapartida_avancar(this.__wbg_ptr, tempo);
    }
    /**
     * @returns {number}
     */
    precisao() {
        const ret = wasm.motordapartida_precisao(this.__wbg_ptr);
        return ret;
    }
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                if (module.headers.get('Content-Type') != 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_export_0;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
        ;
    };
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };

    return imports;
}

function __wbg_init_memory(imports, memory) {

}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedFloat64ArrayMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();

    __wbg_init_memory(imports);

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('motor_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    __wbg_init_memory(imports);

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
