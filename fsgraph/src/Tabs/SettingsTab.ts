import {Controller, id_prefix, ITab, TabConfiguration} from "../@types/GUI";
/*import * as $ from "jquery"; jquery must be environment
import 'jquery-ui/ui/widget';
import 'jquery-ui/ui/widgets/slider';
import 'jquery-ui/ui/widgets/selectmenu';*/
import {Translator} from "../Translator";
import {BooleanParam, ParamType, ScalarParam} from "../@types/Param";
import SliderUIParams = JQueryUI.SliderUIParams;
import {GraphControlling} from "../@types/Graph";
import GraphState = GraphControlling.GraphState;
import {LayoutBuilder} from "..";
import {GraphView} from "../@types/GraphView";
import GraphViewConfiguration = GraphView.GraphViewConfiguration;

const local_id_prefix = '_settings_tab';
const node_alpha_label = id_prefix + local_id_prefix + '_node_alpha_label';
const node_alpha_slider = id_prefix + local_id_prefix + '_node_alpha_slider';
const link_alpha_label = id_prefix + local_id_prefix + '_link_alpha_label';
const link_alpha_slider = id_prefix + local_id_prefix + '_link_alpha_slider';

const node_size_label = id_prefix + local_id_prefix + '_node_size_label';
const node_size_slider = id_prefix + local_id_prefix + '_node_size_slider';
const link_size_label = id_prefix + local_id_prefix + '_link_size_label';
const link_size_slider = id_prefix + local_id_prefix + '_link_size_slider';
const border_size_label = id_prefix + local_id_prefix + '_border_size_label';
const border_size_slider = id_prefix + local_id_prefix + '_border_size_slider';

const node_font_size_input = id_prefix + local_id_prefix + '_node_font_size_input';
const always_show_label_input = id_prefix + local_id_prefix + '_always_show_label_input';
const label_layout_strategy_input = id_prefix + local_id_prefix + '_label_layout_stratefy';

const layout_builder_selector = id_prefix + local_id_prefix + '_layout_builder_selector';
const layout_builder_configuration = id_prefix + local_id_prefix + '_layout_builder_configuration';
const build_layout_button = id_prefix + local_id_prefix + '_build_layout_button';

const fit_screen_button = id_prefix + local_id_prefix + '_fit_to_screen_button';
const calc_modularity_button = id_prefix + local_id_prefix + '_calc_modularity_button';
const reset_modularity_button = id_prefix + local_id_prefix + '_reset_modularity_button';
const graph_export_button = id_prefix + local_id_prefix + '_graph_export_button';
const clustered_graph_export_button = id_prefix + local_id_prefix + '_clustered_graph_export_button';

//solution from: https://stackoverflow.com/questions/17369098/simplest-way-of-getting-the-number-of-decimals-in-a-number-in-javascript
function countDecimals(x: number) {
    if(Math.floor(x) === x) return 0;
    return x.toString().split(".")[1].length || 0; 
}

export class SettingsTab implements ITab {
    // ------------------------- API -------------------------------

    constructor(config?: TabConfiguration) {
        this.container = null;
        this.controller = null;
        this.translator = null;
        if (config) {
            this.layouts = config['Layouts'];
            this.view_config = config['view_config'];
        }
        else
        {
            this.layouts = null;
            this.view_config = null;
        }
    }

    build(htmlContainer: HTMLElement,
          controller: Controller,
          translator: Translator)
    {
        this.container = htmlContainer;
        this.controller = controller;
        this.translator = translator;
        this.container.style.flex = '1 1 auto';
        //----------------- Настройка прозврачности вершин и дуг ----------------
        const alpha_setting = document.createElement('div');
        {
            // --------------- Настройка прозрачности вершин -------------------
            const node_alpha = document.createElement('div');
            {
                //текстовое поле
                const label = document.createElement('div');
                label.innerHTML = `${translator.apply('LOC_PASSIVETEXTALPHA')}`;
                const span = document.createElement('span');
                span.id = node_alpha_label;
                label.appendChild(span);
                //Слайдер для выбора
                const slider = document.createElement('div');
                slider.id = node_alpha_slider;
                slider.style.margin = '10px';
                node_alpha.appendChild(label);
                node_alpha.appendChild(slider);
            }
            // --------------- Настройка прозрачности дуг -------------------
            const link_alpha = document.createElement('div');
            {
                //текстовое поле
                const label = document.createElement('div');
                label.innerHTML = `${translator.apply('LOC_PASSIVEEDGEALPHA')}`;
                const span = document.createElement('span');
                span.id = link_alpha_label;
                label.appendChild(span);
                //Слайдер для выбора
                const slider = document.createElement('div');
                slider.id = link_alpha_slider;
                slider.style.margin = '10px';
                link_alpha.appendChild(label);
                link_alpha.appendChild(slider);
            }
            alpha_setting.appendChild(node_alpha);
            alpha_setting.appendChild(link_alpha);
        }
        this.container.appendChild(alpha_setting);
        /*
        * Экспериментально, было выяснено, что программное изменение html разметки
        *  через innerHTML стирает все программные обработчики событий на других элементах, поэтому впреть больше не будем вручную менять innerHTML
        * */
        //this.container.innerHTML += `<br><hr><br>`;
        makeSectionBorder(this.container);

        $('#' + node_alpha_slider).slider({
            min: 0,
            max: 1,
            step: 0.01,
            value: 1,
            slide: (event: Event, ui:SliderUIParams) => {
                const value = ui.value || 0;
                const span = document.getElementById(node_alpha_label);
                span.innerText = ` ${value}`;
                controller("SetNodeAlpha", {"alpha": value});
            },
            create: () => document.getElementById(node_alpha_label).innerText = "1"

        });

        $('#' + link_alpha_slider).slider({
            min: 0,
            max: 1,
            step: 0.01,
            value: 1,
            slide: (event: Event, ui:SliderUIParams) => {
                const value = ui.value || 0;
                const span = document.getElementById(link_alpha_label);
                span.innerText = ` ${value}`;
                controller("SetLinkAlpha", {"alpha": value});
            },
            create: () => document.getElementById(link_alpha_label).innerText = "1"
        });

        // -------------- Настройка размеров вершин и дуг ---------------------
        const size_setting = document.createElement('div');
        {
            // --------------- Настройка размера вершин -------------------
            const node_size = document.createElement('div');
            {
                //текстовое поле
                const label = document.createElement('div');
                label.innerHTML = `${translator.apply('LOC_NODE_SIZE_TEXT')}`;
                const span = document.createElement('span');
                span.id = node_size_label;
                label.appendChild(span);
                //Слайдер для выбора
                const slider = document.createElement('div');
                slider.id = node_size_slider;
                slider.style.margin = '10px';
                node_size.appendChild(label);
                node_size.appendChild(slider);
            }
            // --------------- Настройка размера дуг -------------------
            const link_size = document.createElement('div');
            {
                //текстовое поле
                const label = document.createElement('div');
                label.innerHTML = `${translator.apply('LOC_LINK_SIZE_TEXT')}`;
                const span = document.createElement('span');
                span.id = link_size_label;
                label.appendChild(span);
                //Слайдер для выбора
                const slider = document.createElement('div');
                slider.id = link_size_slider;
                slider.style.margin = '10px';
                link_size.appendChild(label);
                link_size.appendChild(slider);
            }
            // --------------- Настройка размера границ -------------------
            const border_size = document.createElement('div');
            {
                //текстовое поле
                const label = document.createElement('div');
                label.innerHTML = `${translator.apply('LOC_BORDER_SIZE_TEXT')}`;
                const span = document.createElement('span');
                span.id = border_size_label;
                label.appendChild(span);
                //Слайдер для выбора
                const slider = document.createElement('div');
                slider.id = border_size_slider;
                slider.style.margin = '10px';
                link_size.appendChild(label);
                link_size.appendChild(slider);
            }
            size_setting.appendChild(node_size);
            size_setting.appendChild(link_size);
            size_setting.appendChild(border_size);
        }
        this.container.appendChild(size_setting);
        makeSectionBorder(this.container);
        //----------------- slider for nodes ----------------
        {
            $('#' + node_size_slider).slider({
                min: this.view_config.node_size_coeff.range.min,
                max: this.view_config.node_size_coeff.range.max,
                step: this.view_config.node_size_coeff.range.step,
                value: this.view_config.node_size_coeff.value,
                slide: (event: Event, ui: SliderUIParams) => {
                    const val = ui.value
                    const span = document.getElementById(node_size_label);
                    span.innerText = String(val);
                    this.controller("NodeSizeCoeffChanged", {"new_coeff": val});
                },
                create: () => {
                    const span = document.getElementById(node_size_label);
                    span.innerText = String(this.view_config.node_size_coeff.value);
                }
            });
        }
        //----------------- slider for links ----------------
        {
            $('#' + link_size_slider).slider({
                min: this.view_config.link_size_coeff.range.min,
                max: this.view_config.link_size_coeff.range.max,
                step: this.view_config.link_size_coeff.range.step,
                value: this.view_config.link_size_coeff.value,
                slide: (event: Event, ui:SliderUIParams) => {
                    const val = ui.value
                    const span = document.getElementById(link_size_label);
                    span.innerText = String(val);
                    this.controller("LinkSizeCoeffChanged", {"new_coeff": val});
                },
                create: () => {
                    const span = document.getElementById(link_size_label);
                    span.innerText = String(this.view_config.link_size_coeff.value);
                }
            });
        }
        //------------------ slider for borders ----------------------
        {
            $('#' + border_size_slider).slider({
                min: 0.0,
                max: 0.3,
                step: 0.01,
                value: 0.1,
                slide: (event: Event, ui:SliderUIParams) => {
                    const value = ui.value || 0;
                    const span = document.getElementById(border_size_label);
                    span.innerText = ` ${value}`;
                    controller("SetBorderSize", {"size": value});
                },
                create: () => document.getElementById(border_size_label).innerText = " 0.1"
            });
        }

        // ----------- Настройка заголовков вершин ---------------------
        const label_setting = document.createElement('ul');
        label_setting.style.display = 'flex';
        label_setting.style.flexDirection = 'column';
        label_setting.style.padding='0';
        // ------ Настройка размера шрифта вершин --------------------
        {
            const panel = document.createElement('li');
            panel.style.listStyleType='none';
            panel.style.display = 'flex';
            panel.style.flexDirection = 'row';
            {
                const div = document.createElement('div');
                div.style.display = 'flex';
                div.style.flexDirection = 'row';
                div.style.justifyContent = 'space-between';
                div.style.flex = '1';
                const text = document.createElement('span');
                text.innerText = translator.apply('LOC_NODEFONT');
                const input = document.createElement('input');
                input.id = node_font_size_input;
                input.style.width = '70px';
                input.type = 'number';
                input.min = '5';
                input.max = '50';
                input.value = '24';
                input.required = true;
                div.appendChild(text);
                div.appendChild(input);
                panel.appendChild(div);
            }

            const apply_btn = document.createElement('button');
            apply_btn.className = 'scivi_button';
            apply_btn.innerText = translator.apply('LOC_APPLY');
            apply_btn.style.marginLeft = '10px';
            apply_btn.onclick = () => {
                const input = <HTMLInputElement>document.getElementById(node_font_size_input);
                this.controller("SetLabelFontSize",
                    {"font_size": parseInt(input.value)});
            };
            panel.appendChild(apply_btn);
            label_setting.appendChild(panel);

        }
        //----- настройка показа всех заголовков --------
        {
            const panel = document.createElement('li');
            panel.style.listStyleType='none';
            const text = document.createElement('span');
            text.innerText = `${translator.apply('#always_show_labels')}:`;
            const input = document.createElement('input');
            input.id = always_show_label_input;
            input.type = 'checkbox';
            input.value = 'false';
            input.onclick = () => controller("ToggleLabelsShowing", null);
            panel.appendChild(text);
            panel.appendChild(input);

            label_setting.appendChild(panel);
        }
        //----- настройка показа всех весов вершин --------
        {
            const panel = document.createElement('li');
            panel.style.listStyleType='none';
            const text = document.createElement('span');
            text.innerText = `${translator.apply('#always_show_weights')}:`;
            const input = document.createElement('input');
            input.id = always_show_label_input;
            input.type = 'checkbox';
            input.value = 'false';
            input.onclick = () => controller("ToggleWeightsShowing", null);
            panel.appendChild(text);
            panel.appendChild(input);

            label_setting.appendChild(panel);
        }
        //------ Стратегия укладки заголовка возле вершины ------
        {
            const panel = document.createElement('li');
            panel.style.listStyleType='none';
            const text = document.createElement('span');
            text.innerText = `${translator.apply('#label_layout_strategy')}:`;
            const combo = document.createElement('select');
            combo.id = label_layout_strategy_input;
            combo.required = true;
            combo.onchange = () => controller("SelectLabelLayoutStrategy", {"strategy_id": combo.options[combo.selectedIndex].value});
            const around_vertex_strategy = document.createElement('option');
            around_vertex_strategy.value = "0";
            around_vertex_strategy.text = translator.apply('#around_vertex_strategy');
            const inside_vertex_strategy = document.createElement('option');
            inside_vertex_strategy.value = "1";
            inside_vertex_strategy.text = translator.apply('#inside_vertex_strategy');
            inside_vertex_strategy.selected = true;
            combo.appendChild(inside_vertex_strategy);
            combo.appendChild(around_vertex_strategy);
            panel.appendChild(text);
            panel.appendChild(combo);

            label_setting.appendChild(panel);
        }
        this.container.appendChild(label_setting);
        makeSectionBorder(this.container);

        // ----------- Настройка укладки -------------------------
        //если кол-во укладок больше нуля, то создаем секцию для укладок
        if (Object.keys(this.layouts).length > 0) {
            const layout_setting = document.createElement('div');
            {
                const selector = document.createElement('select');
                selector.id = layout_builder_selector;
                selector.name = layout_builder_selector;

                const settings = document.createElement('ul');
                settings.id = layout_builder_configuration;
                settings.style.margin = '10px 10px';


                selector.onchange = () => {
                    settings.innerHTML = '';
                    const selected_layout = this.layouts[selector.value];
                    const layout_config = selected_layout.getConfiguration();
                    if (layout_config) {
                        Object.keys(layout_config).forEach(param_name => {
                            const param = layout_config[param_name];
                            const range = param.range;
                            const li = document.createElement('li');
                            li.style.listStyleType = 'none';
                            li.innerHTML = `${this.translator.apply('#' + param_name + '_text')}: `;
                            const input = document.createElement('input');
                            input.className = 'layout_input';
                            input.id = param_name;
                            if (param instanceof BooleanParam)
                            {
                                input.type = 'checkbox';
                                input.checked = param.value
                            }
                            else
                            {
                                input.type = 'number';
                                input.max = String(range.max);
                                input.min = String(range.min);
                                input.step = String(range.step);
                                input.value = String(range.default);
                            }

                            li.appendChild(input);
                            settings.appendChild(li);
                        });
                    }
                };

                const apply_button = document.createElement('button');
                apply_button.id = build_layout_button;
                apply_button.innerText = translator.apply('LOC_BUILD_LAYOUT');
                apply_button.className = 'scivi_button';
                apply_button.onclick = () => {
                    const selected_layout = this.layouts[selector.value];
                    const config = selected_layout.getConfiguration();
                    //update layout-builder config from gui
                    Object.keys(config).forEach(param => {
                        const input = <HTMLInputElement>document.getElementById(param);
                        switch(config[param].type)
                        {
                            case ParamType.NUMBER: (<ScalarParam>config[param]).value = parseFloat(input.value); break;
                            case ParamType.BOOLEAN: (<BooleanParam>config[param]).value = input.checked;
                        }
                    });
                    this.controller('layout', {'builder': this.layouts[selector.value]});
                };

                layout_setting.appendChild(selector);
                layout_setting.appendChild(settings);
                layout_setting.appendChild(apply_button);
            }
            this.container.appendChild(layout_setting);
            makeSectionBorder(this.container);
            this.fillLayouts();
        }
        // -------------- дополнительные функции --------------------
        const functions = document.createElement('div');
        {
            const FitToScreenBtn = document.createElement('button');
            FitToScreenBtn.className = 'scivi_button';
            FitToScreenBtn.innerText = translator.apply('LOC_FIT_TO_SCREEN');
            FitToScreenBtn.id = fit_screen_button;
            FitToScreenBtn.onclick = () => this.controller("FitToScreen", null);
            const CalcModularityBtn = document.createElement('button');
            CalcModularityBtn.className = 'scivi_button';
            CalcModularityBtn.innerText = translator.apply('LOC_CALC_MODULARITY');
            CalcModularityBtn.id = calc_modularity_button;
            CalcModularityBtn.onclick = () => this.controller("Clusterise", null);
			const ResetModularityBtn = document.createElement('button');
            ResetModularityBtn.className = 'scivi_button';
            ResetModularityBtn.innerText = translator.apply('LOC_RESET_MODULARITY');
            ResetModularityBtn.id = reset_modularity_button;
            ResetModularityBtn.onclick = () => this.controller("ResetClusters", null);
            const GraphExportBtn = document.createElement('button');
            GraphExportBtn.className = 'scivi_button';
            GraphExportBtn.innerText = translator.apply('LOC_SAVE_GRAPH');
            GraphExportBtn.id = graph_export_button;
            GraphExportBtn.onclick = () => this.controller("ExportGraph", null);
			const ClusteredGraphExportBtn = document.createElement('button');
            ClusteredGraphExportBtn.className = 'scivi_button';
            ClusteredGraphExportBtn.innerText = translator.apply('LOC_SAVE_GRAPH_CLUSTERED');
            ClusteredGraphExportBtn.id = clustered_graph_export_button;
            ClusteredGraphExportBtn.onclick = () => this.controller("ExportGraph", {"clustered": true});
			
            const input_file = document.createElement('input');
            input_file.type = 'file';
            input_file.accept = '.json';
            input_file.onchange = (e) => {
                const reader = new FileReader();
                reader.addEventListener('load', (evt) => {
                    this.controller("ImportGraph", {"imported_state": JSON.parse(reader.result as string)});
                    input_file.value = null;
                });
                reader.readAsText(input_file.files[0]);
            }
            input_file.style.display = 'none';
            const GraphImportBtn = document.createElement('button');
            GraphImportBtn.className = 'scivi_button';
            GraphImportBtn.innerText = translator.apply('LOC_LOAD_GRAPH');
            GraphImportBtn.id = graph_export_button;
            GraphImportBtn.onclick = () => input_file.click();
            const TakePhotoBtn = document.createElement('button');
            TakePhotoBtn.className = 'scivi_button';
            TakePhotoBtn.innerText = translator.apply('#save_as_png');
            TakePhotoBtn.onclick = () => this.controller('SavePNG', null);

            functions.appendChild(FitToScreenBtn);
            functions.appendChild(CalcModularityBtn);
			functions.appendChild(ResetModularityBtn);
            functions.appendChild(GraphExportBtn);
            functions.appendChild(GraphImportBtn);
            functions.appendChild(TakePhotoBtn);
			functions.appendChild(ClusteredGraphExportBtn);
        }
        this.container.appendChild(functions);
        makeSectionBorder(this.container);

        const help_button = document.createElement('button');
        help_button.className = 'scivi_button';
        help_button.innerText = translator.apply('LOC_HELP');
        this.container.appendChild(help_button);
    }

    clear(): void
    {

    }

    fill(data: any): void
    {
        const graph: GraphState = data;
    }

    // ----------------------- Private ----------------------
    private container: HTMLElement;
    private controller: Controller;
    private translator: Translator;
    private layouts: {[name: string]: LayoutBuilder};
    private view_config: GraphViewConfiguration;

    private fillLayouts()
    {
        const selector = <HTMLSelectElement>document.getElementById(layout_builder_selector);
        const settings = document.getElementById(layout_builder_configuration);
        Object.keys(this.layouts).forEach(layout => {
            const option = <HTMLOptionElement>document.createElement('option');
            option.value = layout;
            option.innerText = this.translator.apply('#' + layout);
            if (layout == Object.keys(this.layouts)[0])
                option.selected = true;
            selector.appendChild(option);
        });
    }
}

function makeSectionBorder(container: HTMLElement) {
    container.appendChild(document.createElement('br'));
    container.appendChild(document.createElement('hr'));
    container.appendChild(document.createElement('br'));
}