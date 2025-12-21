#!/bin/bash

BASE_DIR="./assets/sounds"
USER_AGENT="Mozilla/5.0"

download_tts() {
    local lang=$1
    local text=$2
    local filename=$3
    local dir="$BASE_DIR/$lang"
    mkdir -p "$dir"
    echo "Pobieranie [$lang]: '$text' -> $filename"
    curl -s -A "$USER_AGENT" \
        --get "https://translate.google.com/translate_tts" \
        --data-urlencode "ie=UTF-8" \
        --data-urlencode "client=tw-ob" \
        --data-urlencode "tl=$lang" \
        --data-urlencode "q=$text" \
        -o "$dir/$filename"
    sleep 0.5
}

echo ">>> Rozpoczynam pobieranie dźwięków..."

# Liczby 1-39
for i in {1..39}
do
    download_tts "pl" "$i" "$i.mp3"
    download_tts "en" "$i" "$i.mp3"
    download_tts "de" "$i" "$i.mp3"
    download_tts "fr" "$i" "$i.mp3" # NOWY JĘZYK
done

# Błędy
download_tts "pl" "Błąd" "wrong.mp3"
download_tts "en" "Wrong" "wrong.mp3"
download_tts "de" "Fehler" "wrong.mp3"
download_tts "fr" "Erreur" "wrong.mp3" # NOWY JĘZYK

echo ">>> Gotowe!"
