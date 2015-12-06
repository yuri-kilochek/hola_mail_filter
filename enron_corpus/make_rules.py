import json
import random

with open('messages.json') as messages_file:
    messages = json.load(messages_file)

addresses = set()
for message in messages.values():
    addresses.add(message['from'])
    addresses.add(message['to'])
addresses = list(addresses)

def patternize(what):
    parts = what.split('.')
    for i in range(len(parts)):
        x = random.uniform(0, 1)
        if x < 0.1:
            parts[i] = '*'
        elif x < 0.15 and len(parts[i]) <= 3:
            parts[i] = '?' * len(parts[i])
    parts = '.'.join(parts)
    return parts

addresses = random.sample(addresses, 200)
for i in range(len(addresses)):
    if random.uniform(0, 1) < 0.05:
        addresses[i] = '*'
    else:
        parts = addresses[i].split('@')
        parts = list(map(patternize, parts))
        addresses[i] = '@'.join(parts)

froms = addresses[:100]
tos = addresses[100:]
rules = []
for i, (f, t) in enumerate(zip(froms, tos)):
    rules.append({ 'from': f, 'to': t, 'action': str(i).zfill(len(str(len(froms))))})

with open('rules.json', 'w') as rules_file:
    json.dump(rules, rules_file, indent=4, sort_keys=True)