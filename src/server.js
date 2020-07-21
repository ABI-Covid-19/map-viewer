/******************************************************************************

COVID-19 map viewer

Copyright (c) 2020  David Brooks

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

******************************************************************************/

'use strict';

//==============================================================================

//const MAP_SERVER_URL = 'https://celldl.org/abi-covid-19/data/';
const MAP_SERVER_URL = 'http://localhost:4329/';

//==============================================================================

export function serverUrl(relativePath='')
//========================================
{
    const url = new URL(relativePath, MAP_SERVER_URL);
    return url.href;
}

//==============================================================================
/*
export function sourceUrl(mapId, url)
//===================================
{
    if (url.startsWith('/')) {
        return `${serverUrl()}${mapId}${url}`; // We don't want embedded `{` and `}` characters escaped
    } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
        console.log(`Invalid URL (${url}) in map's sources`);
    }
    return url;
}
*/
//==============================================================================

export async function loadJSON(relativePath)
//==========================================
{
    const url = `${serverUrl()}${relativePath}`;
    const response = await fetch(url, {
        headers: { "Accept": "application/json; charset=utf-8" },
        method: 'GET'
    });
    if (!response.ok) {
        throw new Error(`Cannot access ${url}`);
    }
    return response.json();
}

//==============================================================================
