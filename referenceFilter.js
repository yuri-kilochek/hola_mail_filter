'use strict';

function referenceFilter(args, emit) {
    args = JSON.stringify(args);
    require('http').request({
        host: 'hola.org',
        method: 'POST',
        path: '/challenge_mail_filter/reference',
        headers: {
            ['content-type']: 'application/json',
            ['content-length']: args.length,
        },
    }).on('response', response => {
        let res = '';
        response.setEncoding('utf8').on('data', chunk => {
            res += chunk;
        }).on('end', () => {
            if (response.headers['content-type'] === 'text/plain') {
                console.error('ERROR:' + res);
            }
            emit(JSON.parse(res));
        });
    }).on('error', error => {
        console.error('ERROR:' + error);
    }).end(args, 'utf8');
}

module.exports = referenceFilter;
