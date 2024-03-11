import * as Polyglot from 'node-polyglot';

export class Translator {
    private _instance: Polyglot;
    constructor(
        private _locale: string = 'ru'
    ) {
        this._instance = new Polyglot({
            allowMissing: false,
            locale: _locale
        });
    }

    extend(dict: {[_: string]: {[_: string]: string}}) {
        this._instance.extend(dict[this._locale]);

        return this;
    }

    apply(key: string): string {
        return this._instance.t(key);
    }
}

let TranslatorInstance: Translator;
export function getOrCreateTranslatorInstance(lang = '') {
    if (!TranslatorInstance) {
        TranslatorInstance = new Translator(lang);
    }
    return TranslatorInstance;
}
