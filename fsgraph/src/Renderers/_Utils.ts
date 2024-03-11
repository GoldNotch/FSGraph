

export function resizeFloat32Array(size: number, array: Float32Array) : Float32Array
{
    let new_buffer = new Float32Array(size);
    if (size > array.length)
        new_buffer.set(array, 0);
    else {
        for (let i = 0; i < size; ++i)
            new_buffer[i] = array[i];
    }
    return new_buffer;
}

export function resizeUint16Array(size: number, array: Uint16Array) : Uint16Array
{
    let new_buffer = new Uint16Array(size);
    if (size > array.length)
        new_buffer.set(array, 0);
    else {
        for (let i = 0; i < size; ++i)
            new_buffer[i] = array[i];
    }
    return new_buffer;
}