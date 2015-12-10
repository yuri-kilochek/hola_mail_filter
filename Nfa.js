'use strict';

function normalize(pattern) {
    while (true) {
        let newPattern = pattern.replace('*?', '?*');
        if (newPattern === pattern) {
            break;
        }
        pattern = newPattern;
    }
    while (true) {
        let newPattern = pattern.replace('**', '*');
        if (newPattern === pattern) {
            break;
        }
        pattern = newPattern;
    }
    return pattern;
}

function toId(i, n) {
    let s = '';
    do {
        s = String.fromCharCode(i & 0xFFFF) + s;
        i >>= 16;
    } while (i > 0);
    while (s.length < Math.ceil(Math.log(n) / Math.log(0x10000))) {
        s = '\u0000' + s;
    }
    return s;
}

class Nfa {
    constructor(patternsWithFinishes, combineFinishes) {
        let states = [];
        function addState(state) {
            states.push(state);
            return state;
        }

        this.initials = [];
        for (let i = 0; i < patternsWithFinishes.length; ++i) {
            let patternWithFinish = patternsWithFinishes[i];

            let pattern = patternWithFinish[0];
            let finish = patternWithFinish[1];

            let initials = [addState({
                targets: [],
                finish: {
                    id: toId(i, patternsWithFinishes.length),
                    data: {
                        index: i,
                        value: finish,
                    },
                },
            })];

            pattern = normalize(pattern);
            for (let j = pattern.length - 1; j >= 0; --j) {
                let symbol = pattern.charAt(j);
                switch (symbol) {
                  case '*':
                    initials.unshift(addState({
                        targets: initials,
                    }));
                    break;
                  case '?':
                    initials = [addState({
                        targets: initials,
                    })];
                    break;
                  default:
                    initials = [addState({
                        symbol: symbol,
                        targets: initials,
                    })];
                }
            }

            this.initials.push(...initials);
        }

        for (let i = 0; i < states.length; ++i) {
            states[i].id = toId(i, states.length);
        }

        this.combineFinishes = (datas) => {
            datas = Array.from(datas).sort((a, b) => {
                return a.index - b.index;
            }).map(d => d.value);
            return combineFinishes(datas);
        };
    }
}

module.exports = Nfa;

