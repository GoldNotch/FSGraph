import vec2 from "../../modified_modules/tsm/vec2";
import {CanvasManager} from "./CanvasManager";
import {GraphView} from "../@types/GraphView";
import AABB = GraphView.AABB;
import NodeView = GraphView.NodeView;
// ---------------------- Events ------------------------------

export async function onDragScene(sender: object, offset: vec2) {
    const canvas_manager = <CanvasManager>this;
    canvas_manager.translateGraph(offset);
    canvas_manager.update();
}

export async function onZoom(sender: object, dScroll : number, cursor_pos : vec2)
{
    const canvas_manager = <CanvasManager>this;
    canvas_manager.zoomAt(dScroll);
    canvas_manager.update();
}

export async function onClickNode(sender: object, event: MouseEvent)
{
    const canvas_manager = <CanvasManager>this;
    const aabb = <AABB>sender;
    const node = <NodeView>aabb.scene_object;
    if (event.ctrlKey && event.button == 0)
    {
        if (node.is_selected)
            canvas_manager.DeselectNode(node.id);
        else canvas_manager.SelectNode(node.id);
    }
    else if (event.button == 0) {
        canvas_manager.ToggleNode(node.id);
    }
    else if (event.button == 1)
    {
		
    }
    canvas_manager.update();
}

export async function onDragNode(sender: object, offset: vec2)
{
    const canvas_manager = <CanvasManager>this;
    const aabb = <AABB>sender;
    const node = <NodeView>aabb.scene_object;
    canvas_manager.translateNode(node.id, offset);
    canvas_manager.update();
}

export async function onDragEndNode(sender: object)
{
    const aabb = <AABB>sender;
    const node = <NodeView>aabb.scene_object;
    const tree = node.graph_view.quad_tree;
    tree.remove(aabb);
    aabb.x = node.position.x - node.size + 2 * this.view_configuration.scene_size;
    aabb.y = node.position.y - node.size + 2 * this.view_configuration.scene_size;
    tree.push(aabb);
}

export async function onEnterNode(sender: object) {
    const canvas_manager = <CanvasManager>this;
    const aabb = <AABB>sender;
    const node = <NodeView>aabb.scene_object;
    canvas_manager.HoverOnNode(node.id);
    canvas_manager.update();
}

export async function onLeaveNode(sender: object)
{
    const canvas_manager = <CanvasManager>this;
    const aabb = <AABB>sender;
    const node = <NodeView>aabb.scene_object;
    canvas_manager.HoverOffNode(node.id);
    canvas_manager.update();
}