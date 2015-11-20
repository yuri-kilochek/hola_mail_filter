from pathlib import Path
import json
import random

def extract(path):
    from_addr = None
    to_addrs = None
    with path.open(encoding='UTF-8') as message_file:
        for i, line in enumerate(message_file):
            if line.startswith('From: '):
                from_addr = line[6:-1].strip()
            elif line.startswith('To: '):
                to_addrs = [to_addr.strip() for to_addr in line[4:-1].split(', ') if to_addr != '']
            elif i > 10:
                break
    if from_addr is None or to_addrs is None:
        return
    for to_addr in to_addrs:
        yield from_addr, to_addr


def extract_all(root_path):
    for entry in root_path.iterdir():
        if entry.is_dir():
            yield from extract_all(entry)
        else:
            try:
                yield from extract(entry)
            except:
                pass

messages = []
for from_addr, to_addr in extract_all(Path('maildir')):
    messages.append({ 'from': from_addr, 'to': to_addr })
random.shuffle(messages)
messages = messages[:10000]
messages = {str(i).zfill(len(str(len(messages)))): v for i, v in enumerate(messages)}
with open('messages.json', 'w') as messages_file:
    json.dump(messages, messages_file, indent=4, sort_keys=True)

