import {GraphView} from "./GraphView";
import {Param} from "./Param";

export type LayoutConfiguration = {[param: string]: Param<any>};

//Построитель статической укладки
export interface LayoutBuilder
{
    getParamsNames(): string[];
    setConfiguration(config: LayoutConfiguration): void;
    getConfiguration() : LayoutConfiguration;
    layout(graph_view: GraphView.GraphView, scene_size: number) : boolean;
}