import mat3 from "../../modified_modules/tsm/mat3";
import vec2 from "../../modified_modules/tsm/vec2";
import {GraphView} from "../@types/GraphView";
import GraphViewConfiguration = GraphView.GraphViewConfiguration;
import {ShaderCompiler_default} from "../Renderers/_ShaderCompiler";
import * as chroma from 'chroma.ts'
import isLinkViewEmphasized = GraphView.isLinkViewEmphasized;
import isNodeViewEmphasized = GraphView.isNodeViewEmphasized;
import LabelStyle = GraphView.LabelStyle;
import isLinkViewDisabled = GraphView.isLinkViewDisabled;

//Оптимизация
//В любом случае renderer должен запоминать предыдущее состояние и update должен перебирать только обновленные ноды/дуги
//Варианты оптимизации
//1) сделать кучу функций на каждое действие с нодой/дугой. Типа: notify_NodeTranslated - и там обновить геометрию вершины и дуг
//2) 

export default class GraphRenderer
{
    //Параметры класса
    static dScale = 1.25;
    static samples_count = 2;
    static draw_aabb = false;
    //canvas - обязательный аргумент - холст на котором будем рисовать
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.context2D = this.canvas.getContext("2d", {alpha: false});
        this.gl_canvas = document.createElement("canvas");
        //Получаем контекст
        try {
            this.gl = this.gl_canvas.getContext("webgl", {premultipliedAlpha: false});
        }
        catch(e) {
            this.gl = null;
            console.error("Can't create webgl context");
        }
        //настройки рендера
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.ALWAYS);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        this.gl.enable(this.gl.BLEND);
        this.gl.enable(this.gl.CULL_FACE);

        this.camera_pos = new vec2([0,0]);
        this.zoom_direction = new vec2([0,0]);
        this.cursor_pos_Scene = new vec2([0, 0]);
        this.PV = mat3.identity.copy();
        this.PV_inv = mat3.identity.copy();
        this.P = mat3.identity.copy();
        this.S = mat3.identity.copy();
        this.rotation_angle = 0;
        this.labeled_nodes = new Set();
        this.are_links_updated = false;
        this.show_labels_for_each_node = false;
    }

    // ------------------------- public API -------------------------
    //привязать визуальную модель графа для визуализации
    public bindGraphView(graph_view: GraphView.GraphView, view_configuration: GraphViewConfiguration)
    {
        this.graph_view = graph_view;
        this.view_configuration = view_configuration;
        view_configuration.scroll_value.Reset();
        view_configuration.link_renderer.bindContext(this.gl, ShaderCompiler_default);
        Object.keys(view_configuration.node_renderer_per_group).forEach(group => {
            view_configuration.node_renderer_per_group[group].bindContext(this.gl, ShaderCompiler_default);
        });
        //очищаем объекты из кэша
        view_configuration.link_renderer.clearObjects();
        Object.keys(view_configuration.node_renderer_per_group).forEach(group => view_configuration.node_renderer_per_group[group].clearObjects());
        
        Object.values(graph_view.nodes).forEach(node_view => {
            view_configuration.node_renderer_per_group[node_view.group].addObject(node_view);
        });
        graph_view.links.forEach(link_view =>
            view_configuration.link_renderer.addObject(link_view));
        this.labeled_nodes.clear();
        this.show_labels_for_each_node = view_configuration.always_show_labels;
        this.are_links_updated = true;
    }

    public refreshNode(node_view: GraphView.NodeView)
    {
        if (node_view.is_hidden)
        {
            //delete geometry
            this.view_configuration.node_renderer_per_group[node_view.group].deleteObject(node_view);
            //delete label
            this.labeled_nodes.delete(node_view);
        }
        else
        {
            //add or update geometry
            this.view_configuration.node_renderer_per_group[node_view.group].addObject(node_view);
            if (this.show_labels_for_each_node || 
                node_view.is_hovered || node_view.is_selected || 
                node_view.is_toggled || node_view.selected_adjacent_vertex_count > 0)
                this.labeled_nodes.add(node_view);
            else this.labeled_nodes.delete(node_view);
        }
    }

    public refreshLink(link_view: GraphView.LinkView)
    {
        if (isLinkViewDisabled(link_view)) 
            this.view_configuration.link_renderer.deleteObject(link_view);
        else //add or update if exists
            this.view_configuration.link_renderer.addObject(link_view);
        this.are_links_updated = true;
    }

    //нарисовать граф на канвасе
    public render()
    {
        const clientWidth = this.canvas.clientWidth;
        const clientHeight = this.canvas.clientHeight;
        //console.log(inner_rect);
        const aspect = clientWidth / clientHeight;
        const config = this.view_configuration;
        if (!config) return;
        //подгоняем экран под размер
        GraphRenderer.resizeCanvasFramebuffer(this.canvas, clientWidth, clientHeight);
        GraphRenderer.resizeCanvasFramebuffer(this.gl_canvas, clientWidth * GraphRenderer.samples_count,
            clientHeight * GraphRenderer.samples_count);
        this.gl.viewport(0, 0, clientWidth * GraphRenderer.samples_count, clientHeight * GraphRenderer.samples_count);

        //------ Формируем матрицу PV ---------
        const cos = Math.cos(this.rotation_angle);
        const sin = Math.sin(this.rotation_angle);
        const w = 1.0 / aspect / config.scene_size;
        const h = 1.0 / config.scene_size;
        const x = (this.camera_pos.x) * w;
        const y = (this.camera_pos.y) * h;
        //Это результат умножения трех матриц:
        /*
        * cos -sin 0   w 0 0   1 0 0
        * sin  cos 0 * 0 h 0 * 0 1 0
        * 0    0   1   0 0 1   x y 1
        * */
        this.P.init(([w * cos, -sin * h, 0,
                        w * sin, h * cos, 0,
                        x, y, 1]));
        const scale = this.view_configuration.scroll_value.value;
        const z_x = -this.zoom_direction.x * scale + this.zoom_direction.x;
        const z_y = -this.zoom_direction.y * scale + this.zoom_direction.y;
        this.S.init([scale, 0, 0,
                    0, scale, 0,
                    z_x, z_y, 1]);
        mat3.product(this.P, this.S, this.PV);
        this.PV_inv.init(this.PV.all());
        this.PV_inv.inverse();

        if (config.always_show_labels && !this.show_labels_for_each_node)
        {
            Object.values(this.graph_view.nodes)
                .filter(x => !x.is_hidden)
                .forEach(x => this.labeled_nodes.add(x));
            this.show_labels_for_each_node = true;
        }
        if (!config.always_show_labels && this.show_labels_for_each_node)
        {
            this.labeled_nodes.clear();
            Object.values(this.graph_view.nodes)
                .filter(x => isNodeViewEmphasized(x))
                .forEach(x => this.labeled_nodes.add(x));
            this.show_labels_for_each_node = false;
        }
        

        this.context2D.fillStyle = 'white';
        this.context2D.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawGraph();
        //this.drawSceneBounding();
        if (this.view_configuration.always_show_weights)
            this.drawEdgeWeights();
        this.drawLabels();
        if (GraphRenderer.draw_aabb)
            this.drawAABBs();
        //this.drawCursor();
        this.are_links_updated = false;
    }

    //переместить граф
    public moveCamera(offset: vec2)
    {
        this.camera_pos.x += offset.x * this.view_configuration.scene_size;
        this.camera_pos.y += offset.y * this.view_configuration.scene_size;
    }

    //отмасштабировать граф
    public scaleGraph(dScroll: number)
    {
        dScroll = Math.pow(1.25, dScroll);
        let diff = vec2.difference(this.cursor_pos_Scene, this.zoom_direction);
        this.view_configuration.scroll_value.value *= dScroll;

        this.zoom_direction.x += diff.x * dScroll;
        this.zoom_direction.y += diff.y * dScroll;
    }

    //повернуть граф на угол new_rotation(в радианах)
    set rotation(new_rotation: number)
    {
        this.rotation_angle = new_rotation;
    }

    get rotation(){
        return this.rotation_angle;
    }

    //получить коэффициент приближения
    get scaleFactor()
    {
        return this.view_configuration.scroll_value.value;
    }

    //получить позицию курсора в координатах сцены
    get CursorPosAtScene()
    {
        return this.cursor_pos_Scene;
    }

    set CursorPos(value: vec2)
    {
        this.cursor_pos_Scene.x = value.x;
        this.cursor_pos_Scene.y = value.y;
        this.ClientToScene(this.cursor_pos_Scene);
    }

    // ------------------------ Private -----------------------
    private graph_view: GraphView.GraphView;            //визуальная модель графа
    private view_configuration: GraphViewConfiguration; //настройка визуализации
    private labeled_nodes : Set<GraphView.NodeView>;
    private are_links_updated: boolean;
    private show_labels_for_each_node : boolean;
    
    private readonly canvas;                        //канвас исходный
    private readonly context2D : CanvasRenderingContext2D;                     //контекст исходного канваса - берем context2D
    private readonly gl_canvas: HTMLCanvasElement;  //новый канвас(фреймбуфер) для рисования webgl
    private readonly gl: WebGLRenderingContext;     //контекст webgl у нового канваса
    //матрица перевода из координат сцены в NDC
    //Получается из произведения четырех матриц
    private readonly PV : mat3;
    private readonly PV_inv : mat3;
    private readonly P: mat3;
    private readonly S: mat3;
    //расположение камеры на сцене(в координатах сцены)
    private readonly camera_pos: vec2;
    //направление зума (в координатах сцены)
    private readonly zoom_direction : vec2;
    //позиция курсора (в координатах сцены)
    private readonly cursor_pos_Scene: vec2;
    private rotation_angle: number;

    //ATTENTION! This method change param by pointer
    private SceneToClient(pos: vec2) : void
    {
        this.PV.multiplyVec2(pos, pos);
        pos.x = (pos.x + 1) * this.canvas.clientWidth / 2;
        pos.y = (-pos.y + 1) * this.canvas.clientHeight / 2;
    }

    //ATTENTION! This method change param by pointer
    private ClientToScene(pos: vec2) : void
    {
        const rect = this.canvas.getBoundingClientRect();
        pos.x = 2 * (pos.x - rect.left) / rect.width - 1;
        pos.y = 2 * (pos.y - rect.top) / rect.height - 1;
        pos.y *= -1;
        this.PV_inv.multiplyVec2(pos, pos);
    }

    private drawGraph(): void
    {
        const config = this.view_configuration;
        if (this.are_links_updated)
            config.link_renderer.sortObjects();
        this.gl.clearColor(1.0, 1.0, 1.0, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        config.link_renderer.render(this.PV, 0);
        Object.keys(config.node_renderer_per_group).forEach(group => {
            config.node_renderer_per_group[group].render(this.PV, config.node_border_width);
        });

        //this.context2D.clearRect(0, 0, this.canvas.width, this.canvas.height); --clear rect is not working correct!
        this.context2D.drawImage(this.gl_canvas, 0, 0, this.canvas.width, this.canvas.height);
    }

    //нарисовать заголовки у всех вершин
    private drawLabels()
    {
        const label_painter = this.view_configuration.label_painter;

        //расставляем лэйблы у выделенных вершин
        const label_position = new vec2();
        const label_direction = new vec2();//направление заголовка
        var style : LabelStyle = null;
        if (this.view_configuration.label_layout_strategy == 0){
            style = {font_size: this.view_configuration.label_font_size,
                        is_bordered: true,
                        is_bold: false,
                        padding: 5,
                        text_color: '#000000',
                        background_color: '#ffffff' };
        }
        else
        {
            style = {font_size: this.view_configuration.label_font_size,
                        is_bordered: false,
                        is_bold: false,
                        padding: 5,
                        text_color: '#000000',
                        background_color: null };
        }

        this.labeled_nodes.forEach(node => {
            if (this.view_configuration.label_layout_strategy == 0)
            {
                label_position.x = 0;
                label_position.y = 0;
                label_direction.x = 0;
                label_direction.y = 0;
                //обхоим все соседние выделенные вершины
                this.labeled_nodes.forEach(neighbor => {
                    const dX = neighbor.position.x - node.position.x;
                    const dY = neighbor.position.y - node.position.y;
                    const length = Math.sqrt(dX * dX + dY * dY);
                    if (length > 0) {
                        label_direction.x += dX / length;
                        label_direction.y += dY / length;
                    }
                });
                const tan = label_direction.y / label_direction.x;
                if (label_direction.x > 0 && tan > 1.0 ||
                    label_direction.x < 0 && tan < -1.0)
                {
                    label_direction.x = 0;
                    label_direction.y = 1;
                }
                else if (tan <= 1.0 && tan > -1.0)
                {
                    label_direction.y = 0;
                    if (label_direction.x > 0)
                        label_direction.x = 1;
                    else
                        label_direction.x = -1;
                }
                else if (label_direction.x > 0 && tan < -1.0 ||
                    label_direction.x < 0 && tan > 1.0)
                {
                    label_direction.x = 0;
                    label_direction.y = -1;
                }
                const cos = Math.cos(this.rotation_angle);
                const sin = Math.sin(this.rotation_angle);
                label_direction.x = -label_direction.x;
                label_direction.y = -label_direction.y;
                //сначала все смещения в координатах сцены
                label_position.x = node.position.x + (label_direction.x * node.size * cos - label_direction.y * node.size * sin);
                label_position.y = node.position.y + (label_direction.x * node.size * sin + label_direction.y * node.size * cos);
            }
            else if (this.view_configuration.label_layout_strategy == 1)
            {
                label_position.x = node.position.x;
                label_position.y = node.position.y;
            }
            //потом переходим в клиентские координаты окна (канваса)
            this.SceneToClient(label_position);
            style.is_bold = node.is_selected;
            this.drawLabel(node.data.label, label_position, label_direction, style);
        });
    }

    //нарисовать заголовок у вершины
    private drawLabel(label: string, client_pos: vec2, direction: vec2,
                      style: LabelStyle)
    {
        this.context2D.font = `${style.is_bold ? 'bold': ''} ${style.font_size}px sans-serif`;
        const text_width = this.context2D.measureText(label).width;
        const rect_width = text_width + 2 * style.padding;
        const rect_height = style.font_size + 2 * style.padding;
        client_pos.x += direction.x * (rect_width / 2);
        client_pos.y -= direction.y * (style.font_size);
        //заполняем фон
		if (style.background_color){
			this.context2D.fillStyle = chroma.color(style.background_color).css();
			this.context2D.fillRect(client_pos.x - rect_width / 2, client_pos.y - rect_height / 2, rect_width, rect_height);
		}
        //заполняем текст
        this.context2D.fillStyle = chroma.color(style.text_color).css();

        this.context2D.fillText(label, client_pos.x - text_width / 2, client_pos.y + style.padding);
        //делаем границу
        if(style.is_bordered)
            this.context2D.strokeRect(client_pos.x - rect_width / 2, client_pos.y - rect_height / 2, rect_width, rect_height);
    }

    private drawEdgeWeights()
    {
        const pos = new vec2([0, 0]);
        this.graph_view.links.forEach(link => {
            const weight : number = link.data['weight'];
            if (weight) {
                const weight_str = String(weight.toFixed(1));
                pos.x = link.to.position.x - link.from.position.x;
                pos.y = link.to.position.y - link.from.position.y;
                const len = pos.length();
                const cos = pos.x / len;
                const sin = pos.y / len;
                pos.x = link.from.position.x + pos.x / 2 - (link.size + 1) * sin;
                pos.y = link.from.position.y + pos.y / 2 + (link.size + 1) * cos;
                this.SceneToClient(pos);
                //применяем смещения в клиентских координатах
                const weight_width = this.context2D.measureText(weight_str).width;
                const font_size = this.view_configuration.label_font_size;
                this.context2D.fillStyle = 'black';
                //заполняем текст
                this.context2D.fillText(weight_str, pos.x - weight_width / 2, pos.y + font_size / 2);
            }
        });
    }

    //нарисовать контуры AABB(для отладки)
    private drawAABBs()
    {
        var left_top = new vec2();
        var right_bottom = new vec2();
        this.graph_view.quad_tree.each(aabb => {
            left_top.x = aabb.x - this.view_configuration.scene_size;
            left_top.y = aabb.y - this.view_configuration.scene_size;
            right_bottom.x = aabb.x + aabb.width - this.view_configuration.scene_size;
            right_bottom.y = aabb.y + aabb.height - this.view_configuration.scene_size;
            this.SceneToClient(left_top);
            this.SceneToClient(right_bottom);
            this.context2D.strokeRect(left_top.x, left_top.y,
                right_bottom.x - left_top.x, right_bottom.y - left_top.y);
        });
    }

    private drawCursor()
    {
        var pos = new vec2(this.cursor_pos_Scene.xy);
        this.SceneToClient(pos);
        this.context2D.fillRect(pos.x - 2.5, pos.y - 2.5, 5, 5);
    }

    private drawSceneBounding()
    {
        this.context2D.strokeStyle = 'gray';
        const left_top = new vec2([-this.view_configuration.scene_size, this.view_configuration.scene_size]);
        const right_bottom = new vec2([this.view_configuration.scene_size, -this.view_configuration.scene_size]);
        this.SceneToClient(left_top);
        this.SceneToClient(right_bottom);
        this.context2D.strokeRect(left_top.x, left_top.y, right_bottom.x - left_top.x, right_bottom.y - left_top.y);
    }

    //изменить размер фреймбуфера канваса
    private static resizeCanvasFramebuffer(canvas: HTMLCanvasElement, width, height)
    {
        //  проверяем, отличается ли размер canvas
        if (canvas.width  !== width ||
            canvas.height !== height) {

            // подгоняем размер буфера отрисовки под размер HTML-элемента
            canvas.width = width;
            canvas.height = height;
        }
    }
}