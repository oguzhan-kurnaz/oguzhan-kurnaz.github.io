# aasist.onnx

AASIST spoofing countermeasure (Jung et al., ICASSP 2022), weights from
https://github.com/clovaai/aasist (`models/weights/AASIST.pth`, trained on ASVspoof 2019 LA),
exported to ONNX (opset 17). Licence: MIT, Copyright (c) 2021-present NAVER Corp.

- Input  `waveform`: float32 [1, 64600], 16 kHz, values in [-1, 1]
- Output `probs`:    float32 [1, 2] = softmax([spoof, bona fide])

Verified against the PyTorch model (max abs difference < 1e-6).
