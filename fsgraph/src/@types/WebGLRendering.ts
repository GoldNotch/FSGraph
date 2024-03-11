import {mat3} from "../../modified_modules/tsm/tsm";

export module Rendering
{
    export type Color = [number, number, number, number];
    //связать контекст с шейдером
    //отправить буферы на видеокарты
    //запустить рендеринг
    //отвязать контекст от шейдера

    export interface IRenderer{
        render(PV: mat3, border_width: number): void;
        bindContext(gl: WebGLRenderingContext, compiler: IShaderCompiler);
        addObject(object: any) : void;
        deleteObject(object: any) : void;
        clearObjects() : void;
        sortObjects() : void;
    }

    export type ShaderProgramSource = {
        vertex_shader: string;
        fragment_shader: string;
        uniforms: string[];
        attributes: string[];
    };

    export type CompiledShaderProgram = {
        program: WebGLProgram;
        attributes: {[id: string] : GLuint};
        uniforms: {[id: string] : WebGLUniformLocation};
    }

    export interface IShaderCompiler{
        compile(gl: WebGLRenderingContext, source: ShaderProgramSource) : CompiledShaderProgram;
    }


}