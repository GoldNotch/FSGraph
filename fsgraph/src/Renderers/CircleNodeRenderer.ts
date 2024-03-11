import IRenderer = Rendering.IRenderer;
import {GraphView} from "../@types/GraphView";
import NodeView = GraphView.NodeView;
import {Rendering} from "../@types/WebGLRendering";
import IShaderCompiler = Rendering.IShaderCompiler;
import ShaderProgramSource = Rendering.ShaderProgramSource;
import {resizeFloat32Array, resizeUint16Array} from "./_Utils";
import CompiledShaderProgram = Rendering.CompiledShaderProgram;
import mat3 from "../../modified_modules/tsm/mat3";
import isNodeViewEmphasized = GraphView.isNodeViewEmphasized;


//mat3*3 + vec4 = 9 + 4 = 13
const FLOATS_PER_INSTANCE = 13;
const BYTES_PER_INSTANCE = Float32Array.BYTES_PER_ELEMENT * FLOATS_PER_INSTANCE;

type InstancedData = {
    attributes: Float32Array;     //матрицы + цвет
    objects_count: number;      //кол-во объектов
    max_objects_count: number;
}

export class CircleNodeRenderer implements IRenderer
{
    constructor() {
        this.instanced_data = {attributes: new Float32Array(BYTES_PER_INSTANCE * this.default_max_objects_count),
                        objects_count: 0,
                        max_objects_count: this.default_max_objects_count};
        this.offsets = new Map<object, number>();
        this.gl = null;
        this.program = null;
        this.objects = [];
    }

    render(PV : mat3, border_width: number): void
    {
        this.gl.useProgram(this.program.program);

        this.gl.uniformMatrix3fv(this.program.uniforms["u_pv"], false, PV.all());
        this.gl.uniform1f(this.program.uniforms["u_border_width"], border_width);
        // --------------------- attach vbo ------------------------------
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vbo);
        this.gl.enableVertexAttribArray(this.program.attributes['a_vertexPos']);
        this.gl.vertexAttribPointer(this.program.attributes['a_vertexPos'], 2, this.gl.FLOAT, false, 8, 0);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanced_buffer);
        //this.gl.bufferData(this.gl.ARRAY_BUFFER, this.instanced_data.attributes, this.gl.DYNAMIC_DRAW);
        const transform_loc = this.program.attributes['a_transform'];
        const transform_size = Float32Array.BYTES_PER_ELEMENT * 9;
        const transform_row_size = 3 * Float32Array.BYTES_PER_ELEMENT;
        for(let i = 0; i < 3; ++i){
            this.gl.enableVertexAttribArray(transform_loc + i);
            this.gl.vertexAttribPointer(transform_loc + i, 3, this.gl.FLOAT, false, 
                                        BYTES_PER_INSTANCE, 
                                        i * transform_row_size);
            this.gl_ext.vertexAttribDivisorANGLE(transform_loc + i, 1);
        }
        this.gl.enableVertexAttribArray(this.program.attributes['a_color']);
        this.gl.vertexAttribPointer(this.program.attributes['a_color'], 4, this.gl.FLOAT, false, BYTES_PER_INSTANCE, transform_size);
        this.gl_ext.vertexAttribDivisorANGLE(this.program.attributes['a_color'], 1);

        this.gl_ext.drawArraysInstancedANGLE(this.gl.TRIANGLE_FAN, 0, 4, this.instanced_data.objects_count);
        //reset state
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
        this.gl.disableVertexAttribArray(this.program.attributes["a_vertexPos"]);
        for(let i = 0; i < 3; ++i){
            this.gl.disableVertexAttribArray(transform_loc + i);
            this.gl_ext.vertexAttribDivisorANGLE(transform_loc + i, 0);
        }
        this.gl.disableVertexAttribArray(this.program.attributes["a_color"]);
        this.gl_ext.vertexAttribDivisorANGLE(this.program.attributes['a_color'], 0);
    }

    bindContext(gl: WebGLRenderingContext, compiler: IShaderCompiler)
    {
        if (this.program)
        {
            this.gl.deleteProgram(this.program.program);
            this.gl.deleteBuffer(this.vbo);
            this.gl.deleteBuffer(this.instanced_buffer);
        }
        // -------------- create contexts and extensions --------------
        this.gl = gl;
        this.gl_ext = this.gl.getExtension('ANGLE_instanced_arrays');
        if (!this.gl_ext) {
            console.error('need ANGLE_instanced_arrays');
        }
        // -------------- create buffers -------------------
        this.vbo = gl.createBuffer();
        const vertices = new Float32Array([-1.0, -1.0,
                                            1.0, -1.0,
                                            1.0, 1.0,
                                            -1.0, 1.0]);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vbo);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
        this.instanced_buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanced_buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.instanced_data.attributes, this.gl.DYNAMIC_DRAW);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
        //компилируем программу в новом контексте
        // -------------- compile and set shaders ---------------------
        this.program = compiler.compile(gl, this.shader_source);
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
        const node = object as NodeView;
        if (!this.offsets.has(node)) {
            const offset = this.instanced_data.objects_count;
            //вставляем смещение
            this.offsets.set(node, offset);
            //вставляем в геометрию данные об объекте
            const new_attributes = CircleNodeRenderer.makeAttributesArray(node);
            this.instanced_data.attributes.set(new_attributes, offset * FLOATS_PER_INSTANCE);
            this.gl.bufferSubData(this.gl.ARRAY_BUFFER, offset * BYTES_PER_INSTANCE, 
                                this.instanced_data.attributes.subarray(offset * FLOATS_PER_INSTANCE, (offset + 1) * FLOATS_PER_INSTANCE));
            this.objects.push(object);
            this.instanced_data.objects_count++;
        }
        else
        {
            const offset = this.offsets.get(node);
            const new_attributes = CircleNodeRenderer.makeAttributesArray(node);
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
        const node = object as NodeView;
        if(this.offsets.has(node))
        {
            const offset = this.offsets.get(node);
            const last_object_offset = this.instanced_data.objects_count - 1;
            if (offset != last_object_offset)
            {
                this.offsets.set(this.objects[last_object_offset], offset);
                this.objects[offset] = this.objects[last_object_offset];
                //копируем данные с последнего элемента массива в удаленный
                this.instanced_data.attributes.copyWithin(offset * FLOATS_PER_INSTANCE, last_object_offset * FLOATS_PER_INSTANCE,
                                                         (last_object_offset + 1) * FLOATS_PER_INSTANCE);
                this.gl.bufferSubData(this.gl.ARRAY_BUFFER, offset * BYTES_PER_INSTANCE, 
                                        this.instanced_data.attributes.subarray(offset * FLOATS_PER_INSTANCE, (offset + 1) * FLOATS_PER_INSTANCE));
            }
            this.offsets.delete(node);
            this.objects.pop();
            this.instanced_data.objects_count--;
            if (this.instanced_data.objects_count > this.default_max_objects_count &&
                this.instanced_data.objects_count <= this.instanced_data.max_objects_count / 2)
            {
                const data = this.instanced_data;
                //уменьшаем буфера
                data.attributes = resizeFloat32Array(data.attributes.length / 2, data.attributes);
                this.gl.bufferData(this.gl.ARRAY_BUFFER, data.attributes, this.gl.DYNAMIC_DRAW);
                data.max_objects_count /= 2;
            }
        }
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    }

    sortObjects(): void {

    }

    // -------------------- Private ------------------
    private default_max_objects_count = 64;
    private readonly instanced_data: InstancedData;
    //это список в котором каждому вставленному объекту сопоставляется смещение в массивах геометрий, для эффективного удаления
    private offsets: Map<object, number>;
    private objects: NodeView[];

    //контексты
    private gl: WebGLRenderingContext;
    private gl_ext: ANGLE_instanced_arrays;
    //шейдерная программа
    private program: CompiledShaderProgram;
    //Буферы на видеокарте
    private instanced_buffer: WebGLBuffer;
    private vbo: WebGLBuffer;

    // ------------------- Shaders ----------------------

    private vertex_shader_source = `
        attribute vec2 a_vertexPos;    
        attribute mat3 a_transform;     
        attribute vec4 a_color;
        uniform mat3 u_pv;
        uniform float u_border_width;
        varying vec2 v_uv;
        varying vec4 v_color;
        varying float border_width;

        void main(void)
        {
            v_color = a_color;
            v_uv = a_vertexPos;
            border_width = u_border_width;
            gl_Position = vec4(u_pv * a_transform * vec3(a_vertexPos, 1), 1);
        }`;

    private fragment_shader_source = `
        precision mediump float;
        varying vec2 v_uv;
        varying vec4 v_color;
        varying float border_width;
        const float sharpness = 1.0;//резкость границ
        const float base = 64.0;

        void main(void) {
            float R = length(v_uv);
            //shape
            float sh = pow(base, sharpness);
            float alpha_m = max(1.0 - pow(R, sh), 0.0);
            //border
            float border_m = max(1.0 - pow(R + border_width, sh), 0.0);   
            gl_FragColor = vec4(v_color.r * border_m, v_color.g * border_m, v_color.b * border_m, v_color.a * alpha_m);    
        }`;

    private shader_source : ShaderProgramSource = {
        vertex_shader: this.vertex_shader_source,
        fragment_shader: this.fragment_shader_source,
        attributes: ["a_vertexPos", "a_transform", "a_color"],
        uniforms: ["u_pv", "u_border_width"]
    };

    // --------------------- Geometry creators ----------------------------

    private static makeAttributesArray(node: NodeView) : number[]
    {
        //[s_x, 0, 0, 
        // 0, s_y, 0,
        // x, y, 1], r,g,b,a
        let color = node.base_color.gl();
        if (isNodeViewEmphasized(node))
            color = node.emphasized_color.gl();
        const size = node.size;
        return [size, 0, 0, 0, size, 0, node.position.x, node.position.y, 1.0, color[0], color[1], color[2], color[3]];
    }

}