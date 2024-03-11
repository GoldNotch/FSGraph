import {Rendering} from "../@types/WebGLRendering";
import IShaderCompiler = Rendering.IShaderCompiler;
import CompiledShaderProgram = Rendering.CompiledShaderProgram;

class _ShaderCompiler implements IShaderCompiler
{
    compile(gl: WebGLRenderingContext, source: Rendering.ShaderProgramSource): CompiledShaderProgram {
        // ---------------- Компиляция вершинного шейдера --------------------------
        const vertex_shader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertex_shader, source.vertex_shader);
        gl.compileShader(vertex_shader);
        let success = gl.getShaderParameter(vertex_shader, gl.COMPILE_STATUS);
        if (!success) {
            alert(gl.getShaderInfoLog(vertex_shader));
            return null;
        }

        // --------------------- компиляция фрагментного шейдера ----------------------
        const fragment_shader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragment_shader, source.fragment_shader);
        gl.compileShader(fragment_shader);
        success = gl.getShaderParameter(fragment_shader, gl.COMPILE_STATUS);
        if (!success) {
            gl.deleteShader(vertex_shader);
            alert(gl.getShaderInfoLog(fragment_shader));
            return null;
        }

        // ----------------- Сборка программы --------------------------
        const program = gl.createProgram();

        // прикрепляем шейдеры
        gl.attachShader(program, vertex_shader);
        gl.attachShader(program, fragment_shader);

        // компонуем программу
        gl.linkProgram(program);
        //gl.deleteShader(vertex_shader);
        //gl.deleteShader(fragment_shader);
        success = gl.getProgramParameter(program, gl.LINK_STATUS);
        if (!success) {
            return null;
        }

        //поиск местонахождений атрибутов
        const attrib_locations = _ShaderCompiler.getAttributeLocations(gl, program, source.attributes);
        const uniform_locations = _ShaderCompiler.getUniformLocations(gl, program, source.uniforms);
        return {program: program,
                attributes: attrib_locations,
                uniforms: uniform_locations};
    }

    private static getAttributeLocations(gl: WebGLRenderingContext, program: WebGLProgram, variables: string[]) : {[id: string] : GLuint} {
        let foundLocations = {};
        for (let i = 0; i < variables.length; ++i) {
            let name = variables[i];
            let location = -1;
            {
                location = gl.getAttribLocation(program, name);
                if (location === -1) {
                    throw new Error("Program doesn't have required attribute: " + name);
                }
                foundLocations[variables[i]] = location;
            }
        }

        return foundLocations;
    }

    private static getUniformLocations(gl: WebGLRenderingContext, program: WebGLProgram, variables: string[]) : {[id: string] : WebGLUniformLocation} {
        let foundLocations = {};
        for (let i = 0; i < variables.length; ++i) {
            let name = variables[i];
            {
                let ulocation = gl.getUniformLocation(program, name);
                if (ulocation === null) {
                    throw new Error("Program doesn't have required uniform: " + name);
                }
                foundLocations[variables[i]] = ulocation;
            }
        }

        return foundLocations;
    }


}

export const ShaderCompiler_default: _ShaderCompiler = new _ShaderCompiler();
