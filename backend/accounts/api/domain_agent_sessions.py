from threading import Lock
from uuid import uuid4


_domain_thread_lock = Lock()
_domain_thread_maps = {
    "cricket": {},
    "politics": {},
}


def get_or_create_domain_thread_id(agent_key, chat_id=None):
    if chat_id:
        with _domain_thread_lock:
            agent_threads = _domain_thread_maps.setdefault(agent_key, {})
            if chat_id not in agent_threads:
                agent_threads[chat_id] = str(uuid4())
            return agent_threads[chat_id]

    return f"{agent_key}_agent_chat"
