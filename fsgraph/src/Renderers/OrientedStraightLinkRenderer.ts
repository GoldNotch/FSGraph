import {Rendering} from "../@types/WebGLRendering";
import {GraphView} from "../@types/GraphView";
import LinkView = GraphView.LinkView;
import IRenderer = Rendering.IRenderer;
import {resizeFloat32Array, resizeUint16Array} from "./_Utils";
import ShaderProgramSource = Rendering.ShaderProgramSource;
import CompiledShaderProgram = Rendering.CompiledShaderProgram;
import mat3 from "../../modified_modules/tsm/mat3";
import Color from "chroma.ts";
import isLinkViewEmphasized = GraphView.isLinkViewEmphasized;
import isNodeViewEmphasized = GraphView.isNodeViewEmphasized;
import { StraightLinkRenderer } from "./StraightLinkRenderer";

//transform, from_color, to_color, tip_indent, length
const FLOATS_PER_INSTANCE = 9 + 10;
const BYTES_PER_INSTANCE = Float32Array.BYTES_PER_ELEMENT * FLOATS_PER_INSTANCE;

type InstancedData = {
    attributes: Float32Array;   //матрица + цвет начала + цвет конца
    objects_count: number;      //кол-во объектов
    max_objects_count : number;
}

export class OrientedStraightLinkRenderer implements IRenderer
{
    constructor() {
        this.instanced_data = {attributes: new Float32Array(BYTES_PER_INSTANCE * this.default_max_objects_count),
            objects_count: 0,
            max_objects_count: this.default_max_objects_count};
        this.offsets = new Map<LinkView, number>();
        this.objects = [];
    }

    bindContext(gl: WebGLRenderingContext, compiler: Rendering.IShaderCompiler) {
        if (this.program)
        {
            this.gl.deleteProgram(this.program.program);
            this.gl.deleteBuffer(this.vbo);
            this.gl.deleteBuffer(this.instanced_buffer);
        }
        this.gl = gl;
        this.gl_ext = this.gl.getExtension('ANGLE_instanced_arrays');
        if (!this.gl_ext) {
            console.error('need ANGLE_instanced_arrays');
        }
        this.vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        const vertices = new Float32Array([0.0, -1.0,
                                            1.0, -1.0,
                                            1.0, 1.0,
                                            0.0, 1.0
                                            ]);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        this.instanced_buffer = gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanced_buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.instanced_data.attributes, this.gl.DYNAMIC_DRAW);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
        this.program = compiler.compile(gl, this.shader_source);
    }

    render(PV: mat3): void {
        this.gl.useProgram(this.program.program);
        
        this.gl.uniformMatrix3fv(this.program.uniforms["u_pv"], false, PV.all());
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vbo);
        this.gl.enableVertexAttribArray(this.program.attributes["a_vertexPos"]);
        this.gl.vertexAttribPointer(this.program.attributes["a_vertexPos"], 2, this.gl.FLOAT, false, 8, 0);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanced_buffer);
        //this.gl.bufferData(this.gl.ARRAY_BUFFER, this.instanced_data.attributes, this.gl.DYNAMIC_DRAW);
        this.gl.enableVertexAttribArray(this.program.attributes["a_from_color"]);
        this.gl.vertexAttribPointer(this.program.attributes["a_from_color"], 4, this.gl.FLOAT, false, BYTES_PER_INSTANCE, 0);
        this.gl_ext.vertexAttribDivisorANGLE(this.program.attributes["a_from_color"], 1);

        this.gl.enableVertexAttribArray(this.program.attributes["a_to_color"]);
        this.gl.vertexAttribPointer(this.program.attributes["a_to_color"], 4, this.gl.FLOAT, false, BYTES_PER_INSTANCE, 4 * Float32Array.BYTES_PER_ELEMENT);
        this.gl_ext.vertexAttribDivisorANGLE(this.program.attributes["a_to_color"], 1);

        const transform_loc = this.program.attributes["a_transform"];
        for(let i = 0; i < 3; ++i)
        {
            this.gl.enableVertexAttribArray(transform_loc + i);
            this.gl.vertexAttribPointer(transform_loc + i, 3, this.gl.FLOAT, false, BYTES_PER_INSTANCE, (8 + i * 3) * Float32Array.BYTES_PER_ELEMENT);
            this.gl_ext.vertexAttribDivisorANGLE(transform_loc + i, 1);
        }

        this.gl.enableVertexAttribArray(this.program.attributes["a_tip_indent"]);
        this.gl.vertexAttribPointer(this.program.attributes["a_tip_indent"], 1, this.gl.FLOAT, false, BYTES_PER_INSTANCE, (8 + 9) * Float32Array.BYTES_PER_ELEMENT);
        this.gl_ext.vertexAttribDivisorANGLE(this.program.attributes["a_tip_indent"], 1);
        
        this.gl.enableVertexAttribArray(this.program.attributes["a_length"]);
        this.gl.vertexAttribPointer(this.program.attributes["a_length"], 1, this.gl.FLOAT, false, BYTES_PER_INSTANCE, (9 + 9) * Float32Array.BYTES_PER_ELEMENT);
        this.gl_ext.vertexAttribDivisorANGLE(this.program.attributes["a_length"], 1);

        this.gl_ext.drawArraysInstancedANGLE(this.gl.TRIANGLE_FAN, 0, 4, this.instanced_data.objects_count);


        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
        this.gl.disableVertexAttribArray(this.program.attributes["a_vertexPos"]);
        this.gl.disableVertexAttribArray(this.program.attributes["a_from_color"]);
        this.gl_ext.vertexAttribDivisorANGLE(this.program.attributes["a_from_color"], 0);
        this.gl.disableVertexAttribArray(this.program.attributes["a_to_color"]);
        this.gl_ext.vertexAttribDivisorANGLE(this.program.attributes["a_to_color"], 0);
        for(let i = 0; i < 3; ++i)
        {
            this.gl.disableVertexAttribArray(transform_loc + i);
            this.gl_ext.vertexAttribDivisorANGLE(transform_loc + i, 0);
        }
        this.gl.disableVertexAttribArray(this.program.attributes["a_tip_indent"]);
        this.gl_ext.vertexAttribDivisorANGLE(this.program.attributes["a_tip_indent"], 0);
        this.gl.disableVertexAttribArray(this.program.attributes["a_length"]);
        this.gl_ext.vertexAttribDivisorANGLE(this.program.attributes["a_length"], 0);
    }

    addObject(object: any): void
    {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanced_buffer);
        if (this.instanced_data.objects_count == this.instanced_data.max_objects_count)
        {
            const data = this.instanced_data;
            //увеличиваем буфера
            data.attributes = resizeFloat32Array(data.attributes.length * 2, data.attributes);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, data.attributes, this.gl.DYNAMIC_DRAW);
            data.max_objects_count *= 2;
        }
        const link = <LinkView>object;
        if (!this.offsets.has(link)) {
            const offset = this.instanced_data.objects_count;
            //вставляем смещение
            this.offsets.set(link, offset);
            const new_attributes = OrientedStraightLinkRenderer.makeAttributesArray(link);
            //вставляем в геометрию данные об объекте
            this.instanced_data.attributes.set(new_attributes, offset * FLOATS_PER_INSTANCE);
            this.gl.bufferSubData(this.gl.ARRAY_BUFFER, offset * BYTES_PER_INSTANCE, 
                this.instanced_data.attributes.subarray(offset * FLOATS_PER_INSTANCE, (offset + 1) * FLOATS_PER_INSTANCE));
            this.objects.push(link);
            this.instanced_data.objects_count++;
        }
        else
        {
            const offset = this.offsets.get(link);
            //обновляем данные объекта
            const new_attributes = OrientedStraightLinkRenderer.makeAttributesArray(link);
            this.instanced_data.attributes.set(new_attributes, offset * FLOATS_PER_INSTANCE);
            this.gl.bufferSubData(this.gl.ARRAY_BUFFER, offset * BYTES_PER_INSTANCE, 
                this.instanced_data.attributes.subarray(offset * FLOATS_PER_INSTANCE, (offset + 1) * FLOATS_PER_INSTANCE));
        }
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    }

    clearObjects(): void {
        this.offsets.clear();
        this.instanced_data.objects_count = 0;
        this.objects = [];
    }

    deleteObject(object: any): void {
        //удаляем объект. Последний элемент массива меняем с удаляемым чтобы массив был слитным
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanced_buffer);
        const link = <LinkView>object;
        if(this.offsets.has(link))
        {
            const offset = this.offsets.get(link);
            const last_object_offset = this.instanced_data.objects_count - 1;
            if (offset != last_object_offset)
            {
                this.offsets.set(this.objects[last_object_offset], offset);
                this.objects[offset] = this.objects[last_object_offset];
                //копируем данные с последнего элемента массива в удаленный
                this.instanced_data.attributes.copyWithin(offset * FLOATS_PER_INSTANCE, last_object_offset * FLOATS_PER_INSTANCE,  (last_object_offset + 1) * FLOATS_PER_INSTANCE);
                this.gl.bufferSubData(this.gl.ARRAY_BUFFER, offset * BYTES_PER_INSTANCE, 
                    this.instanced_data.attributes.subarray(offset * FLOATS_PER_INSTANCE, (offset + 1) * FLOATS_PER_INSTANCE));
            }
            this.offsets.delete(link);
            this.objects.pop();
            this.instanced_data.objects_count--;
            //освобождаем память если удалили больше половины
            if (this.instanced_data.objects_count > this.default_max_objects_count &&
                this.instanced_data.objects_count <= this.instanced_data.max_objects_count / 2)
            {
                const data = this.instanced_data;
                //увеличиваем буфера
                data.attributes = resizeFloat32Array(data.attributes.length / 2, data.attributes);
                this.gl.bufferData(this.gl.ARRAY_BUFFER, data.attributes, this.gl.DYNAMIC_DRAW);
                data.max_objects_count /= 2;
            }
        }
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    }

    sortObjects() : void
    {
        const sorted_objects = [...this.objects];
        sorted_objects.sort((x, y) => x.zOrder - y.zOrder);
        const stride = FLOATS_PER_INSTANCE;
        //TODO: Оптимизировать!!!
        const new_buf = new Float32Array(this.instanced_data.attributes);
        for(let i = 0; i < this.objects.length; i++)
        {
            const correct_object = sorted_objects[i];
            const correct_object_offset = this.offsets.get(correct_object);
            for(let j = 0; j < stride; j++)
                new_buf[i * stride + j] = this.instanced_data.attributes[correct_object_offset * stride + j];
            this.offsets.set(correct_object, i);
        }
        this.instanced_data.attributes = new_buf;
        this.objects = sorted_objects;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanced_buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.instanced_data.attributes, this.gl.DYNAMIC_DRAW);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    }

    // -------------------- Private ------------------
    private default_max_objects_count = 64;
    private readonly instanced_data: InstancedData;
    //список всех объектов
    private objects: LinkView[];
    //это список в котором каждому вставленному объекту сопоставляется смещение в массивах геометрий, для эффективного удаления
    private offsets: Map<LinkView, number>;
    //Contexts
    private gl: WebGLRenderingContext;
    private gl_ext: ANGLE_instanced_arrays;
    //shader program
    private program: CompiledShaderProgram;
    //buffers
    private vbo: WebGLBuffer;
    private instanced_buffer: WebGLBuffer;

    // ---------------------- Shaders ---------------------------------

    private vertex_shader_source = `
        attribute vec2 a_vertexPos;
        attribute vec4 a_from_color;
        attribute vec4 a_to_color;
        attribute mat3 a_transform;
        attribute float a_tip_indent;
        attribute float a_length;
        uniform mat3 u_pv;
        varying vec4 v_color;
        varying float v_tip_indent;
        varying vec2 v_uv;
        varying float v_length;
        varying float v_tip_start;
        varying float v_tip_end;

        const float tip_length = 1.0;

        void main(void)
        {
            v_color = a_from_color + (a_to_color - a_from_color) * a_vertexPos.x;
            v_tip_indent = a_tip_indent;
            v_length = a_length;
            v_uv = vec2(a_vertexPos.x * v_length, a_vertexPos.y);
            v_tip_end = min(v_length - v_tip_indent, v_length);
            v_tip_start = max(v_tip_end - tip_length, 0.0);
            gl_Position = vec4(u_pv * a_transform * vec3(a_vertexPos, 1), 1);
        }`;

    private fragment_shader_source = `
        precision mediump float;
        varying vec4 v_color;
        varying float v_tip_indent;
        varying vec2 v_uv;
        varying float v_length;
        varying float v_tip_start;
        varying float v_tip_end;

        void main(void) {
            float y = abs(v_uv.y);
            float in_arrow = step(v_tip_start, v_uv.x) - step(v_tip_end, v_uv.x);
            float arrow_func = in_arrow * step(y, (v_tip_end - v_uv.x) );//1.0 if tip_end - v_uv.x > y
            float line_func = step(v_uv.x, v_tip_start) * step(y, 0.5);
            gl_FragColor = vec4(v_color.rgb, v_color.a * step(1.0, arrow_func + line_func));
        }`;

    private shader_source : ShaderProgramSource = {
        vertex_shader: this.vertex_shader_source,
        fragment_shader: this.fragment_shader_source,
        attributes: ["a_vertexPos", "a_from_color", "a_to_color", "a_transform", "a_tip_indent", "a_length"],
        uniforms: ["u_pv"]
    };

    // -------------------- Geometry creators ------------------------

    private static makeAttributesArray(link: LinkView) : number[]
    {
        const from = link.from;
        const to = link.to;
        const dy = to.position.y - from.position.y;
        const dx = to.position.x - from.position.x;
        const len = Math.sqrt(dy*dy + dx*dx);
        const cos = dx / len;
        const sin = dy / len;

        let from_color;
        let to_color;
        //const arrow_height = (to.size + 5 * link.size);
        if (isLinkViewEmphasized(link))
        {
            from_color = link.painter(link.from.emphasized_color.gl());
            to_color = link.painter(link.to.emphasized_color.gl());
            from_color[3] = 1.0;
            to_color[3] = 1.0;
        }
        else
        {
            from_color = link.painter(link.from.base_color.gl());
            to_color = link.painter(link.to.base_color.gl());
        }

        return [from_color[0], from_color[1], from_color[2], from_color[3],
                to_color[0], to_color[1], to_color[2], to_color[3],
                len * cos, len * sin, 0, 
                -link.size * sin, link.size * cos, 0, 
                from.position.x, from.position.y, 1, to.size, len];
    }
}