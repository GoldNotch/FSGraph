import {Controller, id_prefix, ITab} from "../@types/GUI";
import {GraphControlling} from "../@types/Graph";
import {Translator} from "../Translator";
import Graph = GraphControlling.Graph;

export enum StateCalculatorOperand
{
    UNION = "UNION",
    INTERSECT = "INTERSECT",
    DIFF = "DIFF",
    SYMDIFF = "SYMDIFF"
}

const local_id_prefix = '_calculator_tab';

const exprContainer_id = id_prefix + local_id_prefix + '_expression';

export class CalculatorTab implements ITab
{
    build(htmlContainer: HTMLElement, controller: (command: string, args: { [p: string]: any }) => Promise<void>, translator: Translator) {
        this.container = htmlContainer;
        this.controller = controller;
        this.translator = translator;
        this.container.style.height = '100%';

        const m_exprDiv = document.createElement('div');
        m_exprDiv.id = exprContainer_id;
        m_exprDiv.style.marginBottom = '1rem';
        this.container.appendChild(m_exprDiv);
        m_exprDiv.appendChild(document.createElement('br'));

        const addOpBtn = document.createElement('button');
        addOpBtn.className = 'scivi_button';
        addOpBtn.innerText = this.translator.apply("LOC_ADDOPERAND");
        this.container.appendChild(addOpBtn);
        addOpBtn.onclick = this.addOperand.bind(this);

        const calcBtn = document.createElement('button');
        calcBtn.className = 'scivi_button';
        calcBtn.innerText = this.translator.apply("LOC_CALCULATE");
        this.container.appendChild(calcBtn);
        calcBtn.onclick = () => this.controller("CalcState", {"expr": CalculatorTab.buildExpression(m_exprDiv)});

        const cleanBtn = document.createElement('button');
        cleanBtn.className = 'scivi_button';
        cleanBtn.innerText = this.translator.apply("LOC_CLEANCALC");
        this.container.appendChild(cleanBtn);
        cleanBtn.onclick = this.initExpression.bind(this);
    }

    clear(): void {

    }

    fill(data: any): void {
        const graph: Graph = data;
        this.states = graph.states.map(x => x.label);
        this.operators = {};
        Object.keys(StateCalculatorOperand).forEach(op => {
           this.operators[op] = this.translator.apply(`#${op}`);
        });
        this.initExpression();
    }

    // ----------------------- Private ----------------------
    private container: HTMLElement;
    private controller: Controller;
    private translator: Translator;
    private states: string[];
    private operators: {[op: string]: string};

    private initExpression()
    {
        const m_exprDiv = document.getElementById(exprContainer_id);
        m_exprDiv.innerHTML = '';
        m_exprDiv.appendChild(CalculatorTab.createOperandCombo(this.states));
        m_exprDiv.appendChild(CalculatorTab.createOperatorCombo(this.operators));
        m_exprDiv.appendChild(CalculatorTab.createOperandCombo(this.states));
        m_exprDiv.appendChild(document.createElement('br'));

    }

    private addOperand()
    {
        const m_exprDiv = document.getElementById(exprContainer_id);
        m_exprDiv.appendChild(CalculatorTab.createOperatorCombo(this.operators));
        m_exprDiv.appendChild(CalculatorTab.createOperandCombo(this.states));
        m_exprDiv.appendChild(document.createElement('br'));
    }

    private static createOperandCombo(states: string[]): HTMLSelectElement
    {
        const combo = document.createElement('select');
        states.forEach(state => {
            const option = document.createElement('option');
            option.innerText = state;
            option.value = String(states.indexOf(state));
            combo.appendChild(option);
        });
        return combo;
    }

    private static createOperatorCombo(operators: {[op: string]: string}): HTMLSelectElement
    {
        const combo = document.createElement('select');
        Object.keys(operators).forEach(op => {
            const option = document.createElement('option');
            option.innerText = operators[op];
            option.value = op;
            combo.appendChild(option);
        });
        return combo;
    }

    private static buildExpression(exprContainer: HTMLElement): string[]
    {
        const tokens = Array.from(exprContainer.getElementsByTagName('select'));
        return tokens.map(x => x.value);
    }
}