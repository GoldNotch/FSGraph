export type Range<T> = {
    min: T;
    max: T;
    default: T;
    step?: T;
    avg?: T;
}

export function IsInRange(range: Range<number>, value: number) : boolean
{
    return isNaN(value) || (value >= range.min && value <= range.max);
}

export function InvalidRange(){return {min: Infinity, max: -Infinity, default: 0};}

export enum ParamType {
    UNKNONW,
    NUMBER,
    BOOLEAN
}

export class Param<T> {
    protected _value: T;
    protected _range: Range<T>;
    protected _type: ParamType;
    Reset(): void
    {
        this._value = this._range.default;
    }
    get range(){return this._range;}
    get type(){return this._type;}
    get value(){return this._value;}
}

export class ScalarParam extends Param<number>
{
    constructor(min: number, max: number, def?: number, step?: number) {
        super();
        if (isNaN(def)) def = (max + min) / 2;
        else def = Math.min(Math.max(def, min), max);
        this._range = {min: min, max: max,
                        default: def,
                        step: step || Math.min(0.01, Math.pow(10, -Math.max(ScalarParam.countDecimals(max), ScalarParam.countDecimals(min))))};
        this._value = def;
        this._type = ParamType.NUMBER;
    }
    get value(){return this._value;}
    set value(value:number)
    {
        this._value = Math.min(Math.max(value, this._range.min), this._range.max);
    }

    //solution from: https://stackoverflow.com/questions/17369098/simplest-way-of-getting-the-number-of-decimals-in-a-number-in-javascript
    private static countDecimals(x: number) {
        if(Math.floor(x) === x) return 0;
        return x.toString().split(".")[1].length || 0; 
    }

}

export class BooleanParam extends Param<boolean>
{
    constructor(def?: boolean) {
        super();
        this._value = def ? def : false;
        this._range = {min: false, max: true, default: def || false};
        this._type = ParamType.BOOLEAN;
    }
    get value(){return this._value;}
    set value(value:boolean)
    {
        this._value = value;
    }
}