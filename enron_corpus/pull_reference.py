import requests
from time import sleep
import json
from pprint import pprint

sleep_duration_limit = 10.0
sleep_duration_adjust_factor = 2.0
sleep_duration = 1.0

def reference_filter(messages, rules):
    global sleep_duration

    arguments = {
        'messages': messages,
        'rules': rules,
    }
    while True:
        try:
            action_sequences = requests.post('http://hola.org/challenge_mail_filter/reference', json=arguments).json()
            sleep_duration /= sleep_duration_adjust_factor
            return action_sequences
        except:
            sleep_duration = min(sleep_duration_limit, sleep_duration * sleep_duration_adjust_factor)
            sleep(sleep_duration)

def load_json_file(path):
    with open(path) as file:
        return json.load(file)

def dump_json_file(path, value):
    with open(path, 'w') as file:
        json.dump(value, file, indent=4, sort_keys=True)

messages = load_json_file('messages.json')
messages = [(k, messages[k]) for k in sorted(messages)]

rules = load_json_file('rules.json')

def chunk(items, k):
    items_chunk = []
    for item in items:
        items_chunk.append(item)
        if len(items_chunk) == k:
            yield items_chunk
            items_chunk = []
    if len(items_chunk) != 0:
        yield items_chunk

try:
    action_sequences = load_json_file('actionSequences.json')
    last_written = max(action_sequences)
    messages = [(k, v) for k, v in messages if k > last_written]
except:
    action_sequences = {}

for messages_chunk in chunk(messages, 10):
    messages_chunk = dict(messages_chunk)

    action_sequence_chunks = {}
    for rules_chunk in chunk(rules, 10):
        print('\r{}..{} {}..{}'.format(min(messages_chunk), max(messages_chunk), min(r['action'] for r in rules_chunk), max(r['action'] for r in rules_chunk)), end='')
        for message_id, action_sequence_chunk in reference_filter(messages_chunk, rules_chunk).items():
            action_sequence_chunks.setdefault(message_id, []).extend(action_sequence_chunk)
    print()
    pprint(action_sequence_chunks)
    action_sequences.update(action_sequence_chunks)
    dump_json_file('actionSequences.json', action_sequences)
