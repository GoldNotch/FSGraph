
/*
* Класс управляет мышкой на канвасе
* Определяет на что мы кликнули
* Дает Drag&Drop на канвасе
* Дает Zoom на канвасе
* */

import AABB = GraphView.AABB;
import {vec2} from "../../modified_modules/tsm/tsm";
import {GraphView} from "../@types/GraphView";

type objectDetectorFunc = (cursor_pos: vec2) => AABB[];

export class InputManager
{
    private static mouse_sensitivity = 1.0;
    constructor() {
        this.cursor_pos = new vec2([0, 0]);
        this.old_cursor_pos = new vec2([0,0]);
        this.cursor_offset = new vec2([0,0]);
    }
    // ------------- API ------------------------

    bindCanvas(canvas: HTMLCanvasElement,
               object_detector: objectDetectorFunc)
    {
        this.canvas = canvas;
        //назначаем события на канвас
        document.onmousedown = this.onMouseDown.bind(this);
        document.onmouseup = this.onMouseUp.bind(this);
        document.onmousemove = this.onMouseMove.bind(this);
        this.canvas.onwheel = this.onCanvasScroll.bind(this);
        this.canvas.ondblclick = this.onDblCLick.bind(this);
        this.object_detector = object_detector;
    }

    bindScene(scene: GraphView.GraphView)
    {
        this.scene = scene;
    }

    // -------------- Private ------------------
    private canvas: HTMLCanvasElement;
    //позиция курсора в данный момент
    private readonly cursor_pos: vec2;
    //позиция курсора в момент нажатия мыши
    private readonly old_cursor_pos: vec2;
    private readonly cursor_offset: vec2;

    private mouse_moved: boolean;
    private mouse_pressed: boolean;

    private object_detector: objectDetectorFunc;
    private scene: GraphView.GraphView;
    private hovered_objects: AABB[] = [];


    //передвижение камеры через down/up
    private onMouseDown(event: MouseEvent)
    {
        const rect = this.canvas.getBoundingClientRect();
        if (event.clientX > rect.left && event.clientX < rect.right &&
            event.clientY > rect.top && event.clientY < rect.bottom)
        {
            this.old_cursor_pos.xy = [event.clientX, event.clientY];
            this.cursor_pos.xy = this.old_cursor_pos.xy;
            //this string needs to differ the click and the release of mouse button
            this.mouse_moved = false;
            this.mouse_pressed = true;
        }
    }

    private onMouseUp(event: MouseEvent)
    {
		if (this.mouse_pressed && this.hovered_objects.length > 0)
		{
			if (this.mouse_moved)
			{
				if (this.hovered_objects[0].onDragEnd)
					this.hovered_objects[0].onDragEnd(this.hovered_objects[0]);
			}
			else 
			{
				if (this.hovered_objects[0].onClick)
					this.hovered_objects[0].onClick(this.hovered_objects[0], event);
			}
		}
        else if (this.mouse_pressed && !this.mouse_moved && this.hovered_objects.length == 0)
        {
            if (this.scene && this.scene.onClick)
                this.scene.onClick(this.scene, event);
        }
		this.mouse_moved = false;
		this.mouse_pressed = false;        
    }

    private onMouseMove(event: MouseEvent): void
    {
        const aspect = this.canvas.width / this.canvas.height;
        this.cursor_pos.x = event.clientX;
		this.cursor_pos.y = event.clientY;
        if (this.mouse_pressed)
        {
            //эти формулы получаются если сначала координататы курсоров перевести в NDC координаты и затем выполнить вычитание
            this.cursor_offset.x = 2 * (this.cursor_pos.x - this.old_cursor_pos.x) * InputManager.mouse_sensitivity * aspect / this.canvas.width;
            this.cursor_offset.y = -2 * (this.cursor_pos.y - this.old_cursor_pos.y) * InputManager.mouse_sensitivity / this.canvas.height;

            //если есть хоть один выделенный объект и у первого объекта есть функция перемещения, то вызываем ее
            if (this.hovered_objects.length > 0 && this.hovered_objects[0].onDrag)
                this.hovered_objects[0].onDrag(this.hovered_objects[0], this.cursor_offset);
            //если выделенных объектов нет, но у сцены есть функция перемещения, то двигаем сцену
            else if (this.hovered_objects.length == 0 && this.scene && this.scene.onDrag)
                this.scene.onDrag(this.scene, this.cursor_offset);


            this.old_cursor_pos.x = this.cursor_pos.x;
            this.old_cursor_pos.y = this.cursor_pos.y;
            this.mouse_moved = true;
        }
        else {
            const new_hovered_objects = this.object_detector(this.cursor_pos);
            //определяем объекты которые потеряли статус выделения
            this.hovered_objects.filter(x => new_hovered_objects.indexOf(x) == -1 && x.onLeave).forEach(x => x.onLeave(x));
            //определяем объекты которые только что выделились
            new_hovered_objects.filter(x => this.hovered_objects.indexOf(x) == -1 && x.onEnter).forEach(x => x.onEnter(x));
            this.hovered_objects = new_hovered_objects;
        }
    }

    private onDblCLick(event: MouseEvent)
    {
        if (this.hovered_objects.length > 0 && this.hovered_objects[0].onDblClick)
            this.hovered_objects[0].onDblClick(this.hovered_objects[0], event);
    }

    private onCanvasScroll(event: WheelEvent): void
    {
        if(this.scene && this.scene.onZoom)
            this.scene.onZoom(this.scene, event.deltaY / -100, this.cursor_pos);
    }
}