import {Translator} from "../Translator";
import {Range, ScalarParam} from "../@types/Param"

export type Controller = (command: string, args?: {[param: string]: any}) => Promise<void>;

export const id_prefix = 'scivi_fsgraph';

export type GUIConfiguration = {[tab_id: string]: ITab};

export type TabConfiguration = {[arg: string]: any};

export interface ITab
{
    build(htmlContainer: HTMLElement, controller: Controller, translator: Translator);
    clear(): void;
    fill(data: any) : void;
}

export class HTMLSlider
{
    constructor(id: string, label: string)
    {
        this.root = document.createElement('div');
        this.root.id = id;
        //----------- Заголовок ---------------
        {
            const p = document.createElement('p');
            p.innerHTML = `<label class='slider_label'>${label}</label>
                        <input type="number" size="10" onkeydown="size=value.length||10">
                        —
                        <input type="number" size="10" onkeydown="size=value.length||10">`;
            const inputs = p.getElementsByTagName('input');
            this.min_input = inputs[0];
            this.max_input = inputs[1];
            this.root.appendChild(p);
        }
        this.slider = $("<div/>");
        this.root.appendChild(this.slider.get(0));
    }

    setLabel(labelHTML: string)
    {
        const label_elem = this.root.getElementsByClassName('slider_label')[0];
        label_elem.innerHTML = labelHTML;
    }

    setGlobalRange(outer_range: Range<number>) 
    {
        if (outer_range) 
        {
            this.root.style.display = 'block';
            let min_default = outer_range.min;
            if (this.min_param && this.min_param.value > min_default)
                min_default = this.min_param.value;
            let max_default = outer_range.max;
            if (this.max_param && this.max_param.value < max_default)
                max_default = this.max_param.value;

            this.min_param = new ScalarParam(outer_range.min, outer_range.max, min_default);
            this.max_param = new ScalarParam(outer_range.min, outer_range.max, max_default);
            this.cur_range.min = this.min_param.value;
            this.cur_range.max = this.max_param.value;
            
            this.min_input.min = String(this.min_param.range.min);
            this.min_input.max = String(this.min_param.range.max);
            this.min_input.step = String(this.min_param.range.step);
            this.min_input.value = String(this.min_param.value);
            this.min_input.onchange = () => {
                this.min_param.value = parseFloat(this.min_input.value);
                this.slider.slider({
                    values: [this.min_param.value, this.max_param.value]
                });
                this.cur_range.min = this.min_param.value;
                this.cur_range.max = this.max_param.value;
                if (this.onChanged)
                    this.onChanged(this.cur_range);
            };
            this.max_input.min = String(this.max_param.range.min);
            this.max_input.max = String(this.max_param.range.max);
            this.max_input.step = String(this.max_param.range.step);
            this.max_input.value = String(this.max_param.value);
            this.max_input.onchange = () => {
                this.max_param.value = parseFloat(this.max_input.value);
                this.slider.slider({
                    values: [this.min_param.value, this.max_param.value]
                });
                this.cur_range.min = this.min_param.value;
                this.cur_range.max = this.max_param.value;
                if (this.onChanged)
                    this.onChanged(this.cur_range);
            };

            this.slider.slider({
                range: true,
                min: this.min_param.range.min,
                max: this.max_param.range.max,
                step: this.min_param.range.step,
                values: [this.min_param.value, this.max_param.value],
                slide: (event, ui) => {
                    this.min_param.value = ui.values[0];
                    this.max_param.value = ui.values[1];
                    this.min_input.value = String(this.min_param.value);
                    this.max_input.value = String(this.max_param.value);
                    this.cur_range.min = this.min_param.value;
                    this.cur_range.max = this.max_param.value;
                    if (this.onChanged)
                        this.onChanged(this.cur_range);
                }
            });
            if (this.onChanged)
                this.onChanged(this.cur_range);
        }
        else this.clear();
    }

    setRange(range: Range<number>)
    {
        this.min_input.value = String(range.min);
        this.max_input.value = String(range.max);
        this.slider.slider({
            values: [range.min, range.max]
        });
        this.cur_range.min = range.min;
        this.cur_range.max = range.max;
        this.min_param.value = range.min;
        this.max_param.value = range.max;
    }

    appendToElement(container: HTMLElement)
    {
        container.appendChild(this.root);
    }

    clear()
    {
        this.root.style.display = 'none';
    }

    getRange() : Range<number>{return this.cur_range;}

    onChanged : (range: Range<number>) => void;

    private root : HTMLElement;
    private min_input : HTMLInputElement;
    private max_input: HTMLInputElement;
    private slider : JQuery<HTMLElement>;
    private min_param : ScalarParam;
    private max_param: ScalarParam;
    private cur_range: Range<number> = {min: -Infinity, max: Infinity, default: 0};
    
}

export class HTMLSwitch
{
    constructor(states: string[], alternative_states: boolean,
                 label?: string, is_inline: boolean = false)
    {
        this.root = document.createElement(is_inline? "span" : "div");
        this.root.style.display = 'flex';
        this.root.style.flexDirection = 'column';
        this.root.style.alignItems = 'center';
        this.root.style.width = 'fit-content';
        if (label)
        {
            const label_div = document.createElement('div');
            label_div.innerText = label;
            label_div.style.textAlign = 'center';
            label_div.style.width = 'auto';
            this.root.appendChild(label_div);
        }
        this.state_index = 0;
        this.states = states;
        this.alternative_states = alternative_states;
        if (alternative_states)
        {
            const btn = document.createElement('button');
            btn.innerText = states[this.state_index];
            btn.className = 'scivi_button'
            this.btn = btn;
            btn.onclick = () => {
                this.state_index++;
                if (this.state_index >= states.length)
                    this.state_index = 0;
                btn.innerText = states[this.state_index];
                if (this.onSwitch)
                    this.onSwitch(states[this.state_index]);
            };
            this.root.appendChild(btn);
        }
        else
        {
            const buttons = document.createElement('div');
            states.forEach((state, index) => {
                const btn = document.createElement('button');
                btn.innerText = state;
                btn.className = 'scivi_button'
                btn.onclick = () => {
                    this.state_index = index;
                    if (this.onSwitch)
                        this.onSwitch(state);
                };
                buttons.appendChild(btn);
            });
            this.root.appendChild(buttons);
        }
    }

    appendToElement(container: HTMLElement)
    {
        container.appendChild(this.root);
    }

    getRootStyle() : CSSStyleDeclaration{
        return this.root.style;
    }

    setState(state_index) {
        if (this.alternative_states && this.states[state_index]){
            this.state_index = state_index;
            this.btn.innerText = this.states[this.state_index];
        }
    }

    onSwitch: (state: string) => void = undefined;

    private root: HTMLElement;
    private states: string[];
    private state_index: number;
    private alternative_states: boolean;
    private btn: HTMLButtonElement;
}