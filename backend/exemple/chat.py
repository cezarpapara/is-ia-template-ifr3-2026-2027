# Primul program care vorbeste cu un model de limbaj local (Ollama).
# Rulare in container: docker exec -it is-ia-python python exemple/chat.py
import json
import os
import time
 
import httpx
 
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:1.5b")
 
 
def ask(messages, model=MODEL, temperature=0.7, json_format=False,
        max_tokens=300):
    """Trimite mesajele; intoarce (raspuns, secunde, tokeni pe secunda)."""
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        # temperature: variatia raspunsurilor; num_predict: maximum de tokeni
        "options": {"temperature": temperature, "num_predict": max_tokens},
    }
    if json_format:
        payload["format"] = "json"
 
    start = time.perf_counter()
    response = httpx.post(f"{OLLAMA_URL}/api/chat", json=payload, timeout=180)
    seconds = time.perf_counter() - start
    response.raise_for_status()
 
    data = response.json()
    # eval_count = tokeni generati; eval_duration = durata lor, in nanosecunde
    speed = data.get("eval_count", 0) / max(data.get("eval_duration", 1), 1) * 1e9
    return data["message"]["content"], seconds, speed

def main():
    print(f"Model: {MODEL}   Ollama: {OLLAMA_URL}")
 
    # 1. Instructiune de sistem + intrebarea utilizatorului
    system = "Raspunde clar, in cel mult 3 propozitii, in limba romana."
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": "Ce este un agent rational?"},
    ]
    answer, seconds, speed = ask(messages)
    print()
    print(f"[1] {answer}")
    print(f"    {seconds:.1f} s, {speed:.1f} tokeni/s")
     # 2. Aceeasi cerere, de doua ori, la doua temperaturi
    prompt = "Propune un nume scurt pentru o aplicatie de notite."
    question = [{"role": "user", "content": prompt}]
    print()
    for temperature in (0.0, 1.2):
        for attempt in (1, 2):
            answer, _, _ = ask(question, temperature=temperature, max_tokens=20)
            print(f"[2] temperatura {temperature} ({attempt}): {answer.strip()}")
 
    # 3. Raspuns in format JSON, transformat in dictionar Python
    system = (
        "Extrage datele din mesaj. Raspunde DOAR cu JSON de forma "
        '{"materie": "...", "data": "AAAA-LL-ZZ", "ora": "HH:MM", "sala": "..."}'
    )
    text = "Examenul de IA este pe 23 ianuarie 2027, la ora 10, in sala S12."
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": text},
    ]
    answer, seconds, _ = ask(messages, temperature=0, json_format=True)
    data = json.loads(answer)
    print()
    print(f"[3] {data}   ({seconds:.1f} s)")
    print(f"    Sala: {data.get('sala')}, ora: {data.get('ora')}")

if __name__ == "__main__":
    try:
        main()
    except httpx.ConnectError:
        print(f"Ollama nu raspunde la {OLLAMA_URL}. Este pornit?")
    except httpx.HTTPStatusError as error:
        print(f"Eroare {error.response.status_code}: {error.response.text}")
    except json.JSONDecodeError:
        print("Modelul nu a raspuns cu JSON valid. Rulati din nou.")