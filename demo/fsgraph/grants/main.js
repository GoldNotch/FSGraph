/**
 * Сейчас по парам вида "невыделен - выделен";
 * начиная от связи и продолжая всеми типами вершин по группам
 */

var g_colors = [
    // link
    0x4C57D8BB, 0x081973FF,
    // node1
    0xFFBA60FF, 0xFF6F00FF
];

const FSGraph = SciViFSGraph.main;
const GUI_Command = FSGraph.GUI_Command;

function linkPainter(color)
{
     return [color[0], color[1], color[2], color[3] * 0.5];
}

function labelPainter(color) {
    return [1,1,1,1];
}

function controller(command, args)
{
    //обрабатываем команду		
}

function main() {

    //собрали граф
    const serializer = new FSGraph.GraphSerializer();
    const graph = serializer.fromJSON(g_data);

    var lang = FSGraph.getParameterByName("lang") || "ru";
    document.documentElement.lang = lang;
    const translator = FSGraph.getOrCreateTranslatorInstance(lang).extend(g_fsgraph_loc);
    //построили гуй
    const gui = new FSGraph.GUI(controller);

    //делаем стандартные настройки представления для графа
    const link_renderer = new FSGraph.StraightLinkRenderer();
    const node_renderer =  new FSGraph.CircleNodeRenderer();
    //эвристика для определения максимального размера холста, чтобы весь граф поместился
    const scene_size = Math.max(graph.meta.nodes_count / 2.25, 80); 

    //настройка изображения графа
    const graph_view_configuration = {
        link_renderer: link_renderer,
        node_renderer_per_group: {0: node_renderer},
        node_colors_per_group: {0: '#B3D9FFFF'},
        node_sizer: (norm_weight) => Math.sqrt(norm_weight),
        link_sizer: (norm_weight) => norm_weight,
        node_size_coeff: new FSGraph.ScalarParam(1.01, 10),
        link_size_coeff: new FSGraph.ScalarParam(0.51, 2),
        node_border_width: 0.1,
        link_painter: linkPainter,
        label_painter: labelPainter,
        label_font_size: 15,
	    label_layout_strategy: 1,
        always_show_labels: false,
        always_show_weights: false,
        scene_size: scene_size,
        scroll_value: new FSGraph.ScalarParam(1, 5, 1)
    };

    //настройка для круговой укладки
    const CircleLayoutConfig = {
        "R":  new FSGraph.ScalarParam(10, scene_size, (scene_size - 10) / 2, 1),
        "use_cluster_splitting" : new FSGraph.BooleanParam(false),
    }

    //настройка для укладки фрухтермана рейнгольда
    const FruchtermanReingoldConfig = {
        "iterations_count" : new FSGraph.ScalarParam(10, 1000, 100, 5),
        "optimal_vertex_distance" : new FSGraph.ScalarParam(1, 50, 15, 1),
        "is_bounding" : new FSGraph.BooleanParam(true),
        "use_cluster_splitting" : new FSGraph.BooleanParam(false),
    }

    //список всех укладок
    const layouts = {
        "CircleLayout" : new FSGraph.LayoutBuilder_Circle(CircleLayoutConfig),
        "FruchtermanReingoldLayout": new FSGraph.LayoutBuilder_FruchtermanReingold(FruchtermanReingoldConfig)
    };

    //настройка интерфейса(вкладки)
    const gui_configuration = {
        "node_info_tab": new FSGraph.NodeInfoTab(),
        "node_list_tab": new FSGraph.NodeListTab(),
        "settings_tab": new FSGraph.SettingsTab({"Layouts": layouts, "view_config": graph_view_configuration}),
	"clusters_info_tab": new FSGraph.ClusterInfoTab(),
        "calculator_tab": new FSGraph.CalculatorTab(),
        'about_graph_tab': new FSGraph.AboutGraphTab()
    };

    //биндим граф, чтобы нарисовать его
    gui.build(document.body, gui_configuration, translator);
    gui.bindGraph(graph, graph_view_configuration);


    //Должно быть известно какие объекты размещены на канвасе чтобы при клике мыши определять на что нажали
    //Сделаем объект "Канвас для рендеринга GraphView".
    //Он сам будет знать об объектах на канвасе, сам будет следить за рендерингом.
    // Мы будем только команды давать.
    //Каждая вершина и дуга это будут объекты на канвасе
    //Вопрос: как сделать стиль вершин и дуг?
    //ЧТо такое стиль вершин и дуг?
    //Стиль вершин: форма вершины, цвет
    //Стиль дуги: цвет, толщина
}
