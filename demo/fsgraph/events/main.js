/**
 * Сейчас по парам вида "невыделен - выделен";
 * начиная от связи и продолжая всеми типами вершин по группам
 */

var g_colors = [
    // link
    0x4C57D877, 0x081973FF,
    // node1
    0xFFBA60FF, 0xFF6F00FF,
    // node2
    0xD533ff00, 0x0033ff00
];

function linkPainter(color) {
    return [color[0], color[1], color[2], color[3] * 0.5];
}

function labelPainter(color) {
    return [1, 1, 1, 1];
}

const FSGraph = SciViFSGraph.main;
const GUI_Command = SciViFSGraph.main.GUI_Command;
const g_renderer = null;

function controller(command, args) {
    //обрабатываем команду
}

function main() {
    var lang = SciViFSGraph.main.getParameterByName("lang") || "ru";
    document.documentElement.lang = lang;
    const translator = FSGraph.getOrCreateTranslatorInstance(lang).extend(g_fsgraph_loc);

    //построили гуй
    //построили гуй
    const gui = new FSGraph.GUI(controller);
    //собрали граф
    const serializer = new FSGraph.GraphSerializer();
    const graph = serializer.fromJSON(g_data);
    //делаем стандартные настройки представления для графа
    const link_renderer = new FSGraph.OrientedStraightLinkRenderer();
    const scene_size = Math.max(graph.meta.nodes_count / 2.25, 80);

    const graph_view_configuration = {
        link_renderer: link_renderer,
        node_renderer_per_group: {
            0: new FSGraph.CircleNodeRenderer(),
            1: new FSGraph.CircleNodeRenderer()
        },
        node_colors_per_group: {
            0: '#E3CFB1FF',
            1: '#BBC1FAFF'
        },
        node_sizer: (norm_weight) => Math.sqrt(norm_weight),
        link_sizer: (norm_weight) => norm_weight,
        node_size_coeff: new FSGraph.ScalarParam(1.01, 10),
        link_size_coeff: new FSGraph.ScalarParam(0.51, 2),
        node_border_width: 0.1,
        link_painter: linkPainter,
        label_painter: labelPainter,
        label_layout_strategy: 1,
        scene_size: scene_size,
        label_font_size: 15,
        always_show_labels: false,
        always_show_weights: false,
        scroll_value: new FSGraph.ScalarParam(1, 5, 1)
    };

    //настройка для круговой укладки
    const CircleLayoutConfig = {
        "R": new FSGraph.ScalarParam(10, scene_size, (scene_size - 10) / 2, 1),
        "use_cluster_splitting": new FSGraph.BooleanParam(false),
    }

    //настройка для укладки фрухтермана рейнгольда
    const FruchtermanReingoldConfig = {
        "iterations_count": new FSGraph.ScalarParam(10, 1000, 100, 5),
        "optimal_vertex_distance": new FSGraph.ScalarParam(1, 50, 15, 1),
        "is_bounding": new FSGraph.BooleanParam(true),
        "use_cluster_splitting": new FSGraph.BooleanParam(false),
    }

    //список всех укладок
    const layouts = {
        "CircleLayout": new FSGraph.LayoutBuilder_Circle(CircleLayoutConfig),
        "FruchtermanReingoldLayout": new FSGraph.LayoutBuilder_FruchtermanReingold(FruchtermanReingoldConfig)
    };

    //настройка интерфейса(вкладки)
    const gui_configuration = {
        "node_info_tab": new FSGraph.NodeInfoTab(),
        "node_list_tab": new FSGraph.NodeListTab(),
        "settings_tab": new FSGraph.SettingsTab({
            "Layouts": layouts,
            "view_config": graph_view_configuration
        }),
        "clusters_info_tab": new FSGraph.ClusterInfoTab(),
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