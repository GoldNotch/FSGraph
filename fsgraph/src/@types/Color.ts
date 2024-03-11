import * as chroma from "chroma.ts";

function randomNodeColor(alpha: number) : chroma.Color
{
    const h = Math.random() * 360;
    let s = Math.random();
    let l = Math.random();
    s = s * 0.4 + 0.2;
    //Эвристика для вычисления светлоты цвета. Допустимые диапазоны светлоты для вершин: [0.1, 0.35]U[0.65, 0.9]
    l = l * 0.25 + 0.65;
    return chroma.color(h, s, l, "hsl").alpha(alpha);
}

export function createColorsForGraphView(groups_count: number, alpha: number) : string[]
{
    const colors = [];
    const first_color = randomNodeColor(alpha);
    colors.push(first_color.hex('rgba'));
    if (groups_count > 1)
    {
        const delta_h = 360 / groups_count;
        let h = first_color.hsl()[0] + delta_h;
        for (let i = 1; i < groups_count; i++)
        {
            const color = randomNodeColor(alpha).set('hsl.h', h);
            colors.push(color.hex('rgba'));
            h += delta_h;
            if (h > 360)
                h -= 360;
        }
    }
    return colors;
}

export function getEmphasizedColor(color: chroma.Color) : chroma.Color {
    return color.set('hsl.l', 0.5).saturate(1);
}