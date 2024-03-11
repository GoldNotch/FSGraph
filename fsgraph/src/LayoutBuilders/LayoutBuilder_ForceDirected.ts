import {GraphView} from "../@types/GraphView";
import NodeView = GraphView.NodeView;
import AABB = GraphView.AABB;
import NodeGroup = GraphView.NodeGroup;
import {LayoutBuilder, LayoutConfiguration} from "../@types/LayoutBuilder";


export class LayoutBuilder_ForceDirected implements LayoutBuilder
{
    constructor(config?: LayoutConfiguration) {
        this.ranges = config;
    }


    layout(graph_view: GraphView.GraphView, scene_size: number): boolean
    {
        return true;
    }

    getParamsNames(): string[] {
        return ["size", "iterations_count"];
    }

    getConfiguration(): LayoutConfiguration {
        return this.ranges;
    }

    setConfiguration(config: LayoutConfiguration): void {
        this.ranges = config;
    }
    private ranges: LayoutConfiguration;



}