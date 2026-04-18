import os
import re
import json
import numpy as np
from flask import Flask, request, jsonify, render_template, send_from_directory

app = Flask(__name__, template_folder="../templates", static_folder="../static")

# ─────────────────────────────────────────────
#  CORE ALGORITHM 1: Word Frequency Counter
#  Uses plain Python dict — no Counter/collections
# ─────────────────────────────────────────────
def count_word_frequencies(text: str) -> dict:
    """Count word frequencies using a plain dictionary."""
    freq = {}
    words = re.findall(r"[a-zA-Z']+", text.lower())
    for word in words:
        # Strip possessives and short noise
        word = word.strip("'")
        if len(word) < 2:
            continue
        if word in freq:
            freq[word] += 1
        else:
            freq[word] = 1
    return freq


# ─────────────────────────────────────────────
#  CORE ALGORITHM 2: Custom Merge Sort
#  Sorts list of (word, freq) tuples by frequency DESC
# ─────────────────────────────────────────────
def merge_sort(arr: list) -> list:
    """Custom merge sort — sorts (word, freq) tuples by frequency descending."""
    if len(arr) <= 1:
        return arr

    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    return merge(left, right)


def merge(left: list, right: list) -> list:
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        # Sort descending by frequency; tie-break alphabetically
        if left[i][1] > right[j][1] or (
            left[i][1] == right[j][1] and left[i][0] < right[j][0]
        ):
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result


# ─────────────────────────────────────────────
#  CORE ALGORITHM 3: NumPy Word Length Analysis
# ─────────────────────────────────────────────
def numpy_word_length_stats(word_freq_pairs: list) -> dict:
    """Convert word lengths into a NumPy array and compute stats."""
    words = [w for w, _ in word_freq_pairs]
    lengths = np.array([len(w) for w in words])
    return {
        "mean": round(float(np.mean(lengths)), 2),
        "max": int(np.max(lengths)),
        "min": int(np.min(lengths)),
        "std": round(float(np.std(lengths)), 2),
        "total_unique": int(lengths.size),
    }


# ─────────────────────────────────────────────
#  CORE ALGORITHM 4: Expected Compression Ratio
#  If top-10 words → replaced with 1-byte symbol
# ─────────────────────────────────────────────
def compression_ratio(sorted_pairs: list, all_freq: dict) -> dict:
    """
    Calculate expected compression ratio.
    Assumption: each character = 1 byte.
    Replacing a word of length L with a 1-byte symbol saves (L - 1) bytes per occurrence.
    """
    top_10 = sorted_pairs[:10]

    # Total bytes in original document (by word token count)
    total_bytes = sum(len(word) * freq for word, freq in all_freq.items())

    # Bytes saved by replacing top 10 words with single-byte symbols
    saved_bytes = sum((len(word) - 1) * freq for word, freq in top_10 if len(word) > 1)

    compressed_bytes = total_bytes - saved_bytes
    ratio = round((saved_bytes / total_bytes) * 100, 2) if total_bytes > 0 else 0

    return {
        "original_bytes": total_bytes,
        "compressed_bytes": compressed_bytes,
        "saved_bytes": saved_bytes,
        "compression_ratio_percent": ratio,
        "top_10": [
            {
                "word": w,
                "frequency": f,
                "word_length": len(w),
                "bytes_saved": (len(w) - 1) * f,
            }
            for w, f in top_10
        ],
    }


# ─────────────────────────────────────────────
#  ROUTES
# ─────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not file.filename.lower().endswith(".txt"):
        return jsonify({"error": "Only .txt files are supported"}), 400

    try:
        text = file.read().decode("utf-8", errors="ignore")
    except Exception as e:
        return jsonify({"error": f"Could not read file: {str(e)}"}), 400

    if len(text.strip()) == 0:
        return jsonify({"error": "File is empty"}), 400

    # --- Run Pipeline ---
    # Step 1: Count frequencies (plain dict)
    freq_dict = count_word_frequencies(text)

    if len(freq_dict) == 0:
        return jsonify({"error": "No readable words found in the file"}), 400

    # Step 2: Merge Sort
    pairs = list(freq_dict.items())
    sorted_pairs = merge_sort(pairs)

    # Step 3: NumPy stats (on all unique words)
    numpy_stats = numpy_word_length_stats(sorted_pairs)

    # Step 4: Compression ratio
    comp = compression_ratio(sorted_pairs, freq_dict)

    # Step 5: Build response
    total_words = sum(freq_dict.values())
    unique_words = len(freq_dict)

    return jsonify(
        {
            "success": True,
            "file_name": file.filename,
            "total_words": total_words,
            "unique_words": unique_words,
            "numpy_stats": numpy_stats,
            "compression": comp,
            "all_top_20": [
                {"rank": i + 1, "word": w, "frequency": f, "percent": round(f / total_words * 100, 2)}
                for i, (w, f) in enumerate(sorted_pairs[:20])
            ],
        }
    )


@app.route("/sample", methods=["GET"])
def sample():
    """Return a sample text for demo purposes."""
    sample_text = (
        "The quick brown fox jumps over the lazy dog. "
        "The dog barked at the fox and the fox ran away quickly. "
        "The fox was very quick and the dog was very lazy. "
        "In the forest the fox found food and the dog found a bone. "
        "The quick fox and the lazy dog lived happily in the forest. "
        "Every day the fox would run and the dog would sleep. "
        "The forest was full of life because of the fox and the dog. "
        "People said the fox was the quickest animal in the forest. "
        "The dog disagreed and ran as fast as the fox one fine day. "
        "And so the fox and the dog became the best of friends in the forest."
    )
    return jsonify({"text": sample_text})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
