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

let WASM_VECTOR_LEN = 0;

const cachedTextEncoder = (typeof TextEncoder !== 'undefined' ? new TextEncoder('utf-8') : { encode: () => { throw Error('TextEncoder not available') } } );

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
}
    : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
});

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_export_0.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedInt32ArrayMemory0 = null;

function getInt32ArrayMemory0() {
    if (cachedInt32ArrayMemory0 === null || cachedInt32ArrayMemory0.byteLength === 0) {
        cachedInt32ArrayMemory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachedInt32ArrayMemory0;
}

function getArrayI32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getInt32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
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

let cachedUint32ArrayMemory0 = null;

function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}
/**
 * Confere se a combinação de mods é válida; devolve a mensagem do problema, ou `undefined`.
 * @param {number} mods
 * @returns {string | undefined}
 */
export function problemaDosMods(mods) {
    const ret = wasm.problemaDosMods(mods);
    let v1;
    if (ret[0] !== 0) {
        v1 = getStringFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    }
    return v1;
}

/**
 * @param {number} mods
 * @returns {boolean}
 */
export function modsValemRanking(mods) {
    const ret = wasm.modsValemRanking(mods);
    return ret !== 0;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function hashDoBeatmap(bytes) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.hashDoBeatmap(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * @param {number} mods
 * @returns {number}
 */
export function velocidadeDosMods(mods) {
    const ret = wasm.velocidadeDosMods(mods);
    return ret;
}

/**
 * @param {number} mods
 * @returns {number}
 */
export function multiplicadorDosMods(mods) {
    const ret = wasm.multiplicadorDosMods(mods);
    return ret;
}

const InfoDoBeatmapFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_infodobeatmap_free(ptr >>> 0, 1));
/**
 * O que a biblioteca e a seleção mostram de um `.osu`, sem montar a partida.
 */
export class InfoDoBeatmap {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        InfoDoBeatmapFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_infodobeatmap_free(ptr, 0);
    }
    /**
     * @returns {number | undefined}
     */
    get beatmapId() {
        const ret = wasm.infodobeatmap_beatmapId(this.__wbg_ptr);
        return ret[0] === 0 ? undefined : ret[1];
    }
    /**
     * Duração do mapa em ms, do começo até o fim da última nota.
     * @returns {number}
     */
    get duracaoMs() {
        const ret = wasm.infodobeatmap_duracaoMs(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    get dificuldade() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.infodobeatmap_dificuldade(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    get notasLongas() {
        const ret = wasm.infodobeatmap_notasLongas(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number | undefined}
     */
    get beatmapsetId() {
        const ret = wasm.infodobeatmap_beatmapsetId(this.__wbg_ptr);
        return ret[0] === 0 ? undefined : ret[1];
    }
    /**
     * @returns {string}
     */
    get tituloUnicode() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.infodobeatmap_tituloUnicode(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get artistaUnicode() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.infodobeatmap_artistaUnicode(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Pontos de BPM e de velocidade em trios [tempo, duração da batida (NaN se não muda o BPM), velocidade].
     * @returns {Float64Array}
     */
    pontosDeTempo() {
        const ret = wasm.infodobeatmap_pontosDeTempo(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * @returns {string}
     */
    get arquivoDeAudio() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.infodobeatmap_arquivoDeAudio(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    get hp() {
        const ret = wasm.infodobeatmap_hp(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get od() {
        const ret = wasm.infodobeatmap_od(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {string} texto
     */
    constructor(texto) {
        const ptr0 = passStringToWasm0(texto, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.infodobeatmap_new(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        InfoDoBeatmapFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {string | undefined}
     */
    get fundo() {
        const ret = wasm.infodobeatmap_fundo(this.__wbg_ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]).slice();
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * @returns {number}
     */
    get notas() {
        const ret = wasm.infodobeatmap_notas(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {string}
     */
    get mapper() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.infodobeatmap_mapper(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    get teclas() {
        const ret = wasm.infodobeatmap_teclas(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    get titulo() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.infodobeatmap_titulo(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get artista() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.infodobeatmap_artista(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    get previaMs() {
        const ret = wasm.infodobeatmap_previaMs(this.__wbg_ptr);
        return ret;
    }
}

const MotorDoManiaFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_motordomania_free(ptr >>> 0, 1));

export class MotorDoMania {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MotorDoManiaFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_motordomania_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get maiorCombo() {
        const ret = wasm.motordomania_maiorCombo(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * A nota final pela precisão: "SS", "S", "A", "B", "C" ou "D".
     * @returns {string}
     */
    classificacao() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.motordomania_classificacao(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    totalDeJulgamentos() {
        const ret = wasm.motordomania_totalDeJulgamentos(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {string} texto
     * @param {number} mods
     * @param {number} semente
     */
    constructor(texto, mods, semente) {
        const ptr0 = passStringToWasm0(texto, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.motordomania_new(ptr0, len0, mods, semente);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        MotorDoManiaFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    get vida() {
        const ret = wasm.motordomania_vida(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get combo() {
        const ret = wasm.motordomania_combo(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * As notas em trios [coluna, tempo, fim (-1 se é simples)], já no tempo real e com as colunas dos mods.
     * @returns {Int32Array}
     */
    notas() {
        const ret = wasm.motordomania_notas(this.__wbg_ptr);
        var v1 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * Devolve o código do julgamento, ou -1 se o toque não acertou nada.
     * @param {number} coluna
     * @param {number} tempo_ms
     * @returns {number}
     */
    tocar(coluna, tempo_ms) {
        const ret = wasm.motordomania_tocar(this.__wbg_ptr, coluna, tempo_ms);
        return ret;
    }
    /**
     * @param {number} coluna
     * @param {number} tempo_ms
     * @returns {number}
     */
    soltar(coluna, tempo_ms) {
        const ret = wasm.motordomania_soltar(this.__wbg_ptr, coluna, tempo_ms);
        return ret;
    }
    /**
     * @returns {number}
     */
    get teclas() {
        const ret = wasm.motordomania_teclas(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} tempo_ms
     */
    avancar(tempo_ms) {
        wasm.motordomania_avancar(this.__wbg_ptr, tempo_ms);
    }
    /**
     * @returns {boolean}
     */
    get derrota() {
        const ret = wasm.motordomania_derrota(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Os julgamentos desde a última chamada, em grupos de cinco: [nota, coluna, julgamento, ponta (0/1), desvio (NaN sem toque)].
     * @returns {Float64Array}
     */
    eventos() {
        const ret = wasm.motordomania_eventos(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * Janelas no tempo real: [MAX, 300, 200, 100, 50, Miss].
     * @returns {Float64Array}
     */
    janelas() {
        const ret = wasm.motordomania_janelas(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * Quantos de cada julgamento, de MAX a Miss.
     * @returns {Uint32Array}
     */
    contagem() {
        const ret = wasm.motordomania_contagem(this.__wbg_ptr);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {number}
     */
    precisao() {
        const ret = wasm.motordomania_precisao(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    terminou() {
        const ret = wasm.motordomania_terminou(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    pontuacao() {
        const ret = wasm.motordomania_pontuacao(this.__wbg_ptr);
        return ret >>> 0;
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
    imports.wbg.__wbindgen_error_new = function(arg0, arg1) {
        const ret = new Error(getStringFromWasm0(arg0, arg1));
        return ret;
    };
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
    cachedInt32ArrayMemory0 = null;
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
