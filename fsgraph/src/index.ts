//Извлечь значение параметра из URL страницы

export function getParameterByName(name: string, url: string): string | undefined
{
    if (!url)
        url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`);
    var results = regex.exec(url);
    if (!results)
        return undefined;
    if (!results[2])
        return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

export * from "./Translator"
export * from "./GUI"
export * from "./GraphSerializer"
export * from "./Renderers/CircleNodeRenderer";
export * from "./Renderers/OrientedStraightLinkRenderer";
export * from "./Renderers/StraightLinkRenderer";
export * from './LayoutBuilders/LayoutBuilder_Circle';
export * from './LayoutBuilders/LayoutBuilder_FruchtermanReingold';
export * from './Tabs/NodeInfoTab'
export * from './Tabs/NodeListTab'
export * from './Tabs/LinksTab'
export * from './Tabs/SettingsTab'
export * from './Tabs/CalculatorTab'
export * from './Tabs/AboutGraphTab'
export * from './Tabs/ClusterInfoTab'
export * from './@types/LayoutBuilder'
export * from './@types/Param'