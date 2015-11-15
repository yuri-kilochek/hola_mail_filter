'use strict';

let filter = require('./filter');

let res = filter({
//    '0': { from: '*@*',          to: '*@jbx' },
//    '1': { from: '*@*',          to: 'msl@*' },
//    '2': { from: '*',            to: 'dmvnsr@run' },
//    '3': { from: 'ydx@imi',      to: '*@jbx' },
//    '4': { from: '*@msl',        to: '*@*' },
    '5': { from: 'dmvnsr@ywjnc', to: 'ydx@*' },
    '6': { from: 'wrlvgs@ydx',   to: 'ydx@wrlvgs' },
//    '7': { from: '*',            to: 'ydx@*' },
//    '8': { from: '*@ydx',        to: '*' },
//    '9': { from: 'jbx@*',        to: 'run@*' }
}, [
//    { from: 'ydx@ydx',    to: 'wrlvgs@jbx',   action: 'cbfq'   },
//    { from: 'run@wrlvgs', to: 'zngl@run',     action: 'ljtko'  },
    { from: '*@ydx',      to: 'jbx@*',        action: 'cvtdw'  },
    { from: 'wrlvgs@*',   to: 'ywjnc@*',      action: 'agh'    },
//    { from: '*@jbx',      to: 'run@*',        action: 'fzar'   },
//    { from: '*@dmvnsr',   to: 'ywjnc@dmvnsr', action: 'owqv'   },
    { from: 'dmvnsr@*',   to: '*@*',          action: 'fsl'    },
//    { from: '*',          to: '*',            action: 'wbhcds' },
    { from: '*@jbx',      to: '*@*',          action: 'fok'    },
//    { from: 'imi@*',      to: 'zngl@*',       action: 'yuok'   },
]);
//{ '0': [ 'wbhcds' ],
//  '1': [ 'wbhcds' ],
//  '2': [ 'wbhcds' ],
//  '3': [ 'wbhcds' ],
//  '4': [ 'wbhcds' ],
//  '5': [ 'fsl', 'wbhcds' ],
//  '6': [ 'fsl', 'wbhcds', 'fok' ],
//  '7': [ 'wbhcds' ],
//  '8': [ 'wbhcds' ],
//  '9': [ 'wbhcds' ] }


console.log(res);
