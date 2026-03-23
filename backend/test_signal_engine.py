"""Tests for the signal processing engine."""

import numpy as np
from signal_engine import (
    generate_signal,
    sample_signal,
    add_noise,
    get_alias_frequency,
    reconstruct_signal,
    compute_fft,
    compute_error,
    process_signal,
)


def test_generate_signal_sine():
    t, y = generate_signal(100, duration=0.01, sample_rate=10000, wave_type="sine")
    assert len(t) == len(y) == 100
    assert np.max(np.abs(y)) <= 1.0 + 1e-10


def test_generate_signal_square():
    t, y = generate_signal(50, duration=0.02, sample_rate=5000, wave_type="square")
    assert len(t) == len(y) == 100
    # Square wave should be ±1
    assert np.allclose(np.abs(y), 1.0)


def test_sample_signal():
    t, y = generate_signal(100, duration=0.05, sample_rate=10000)
    t_s, y_s = sample_signal(t, y, fs=500)
    assert len(t_s) == 25  # 500 * 0.05
    assert len(y_s) == 25


def test_add_noise_zero():
    signal = np.ones(100)
    result = add_noise(signal, 0.0)
    np.testing.assert_array_equal(result, signal)


def test_add_noise_nonzero():
    signal = np.ones(1000)
    result = add_noise(signal, 0.5)
    assert not np.allclose(result, signal)
    # Mean should still be close to 1
    assert abs(np.mean(result) - 1.0) < 0.1


def test_alias_frequency_no_alias():
    freq, aliased = get_alias_frequency(100, 500)
    assert freq == 100.0
    assert aliased is False


def test_alias_frequency_with_alias():
    freq, aliased = get_alias_frequency(400, 500)
    assert aliased is True
    assert 0 < freq < 250  # Must be < Nyquist


def test_reconstruct_signal():
    t, y = generate_signal(50, duration=0.05, sample_rate=10000)
    t_s, y_s = sample_signal(t, y, fs=500)
    y_recon = reconstruct_signal(t_s, y_s, t)
    # Reconstruction of properly sampled signal should be close
    error = np.mean((y - y_recon) ** 2)
    assert error < 0.1


def test_compute_fft():
    t, y = generate_signal(100, duration=0.05, sample_rate=10000)
    freqs, mags = compute_fft(y, 10000)
    assert len(freqs) == len(mags)
    assert len(freqs) <= 128
    # Peak should be near 100 Hz
    peak_freq = freqs[np.argmax(mags)]
    assert abs(peak_freq - 100) < 50


def test_compute_error():
    original = np.sin(np.linspace(0, 2 * np.pi, 100))
    reconstructed = original + 0.01 * np.random.randn(100)
    err = compute_error(original, reconstructed)
    assert "mse" in err
    assert "snr" in err
    assert "max_error" in err
    assert err["mse"] < 0.01


def test_process_signal_full_pipeline():
    result = process_signal(freq=100, fs=300, noise_level=0.0, wave_type="sine")
    assert "signal" in result
    assert "sampled" in result
    assert "reconstructed" in result
    assert "fft" in result
    assert "alias_freq" in result
    assert "aliased" in result
    assert "error" in result
    assert "params" in result
    assert isinstance(result["signal"]["t"], list)
    assert isinstance(result["signal"]["y"], list)


def test_process_signal_aliased():
    result = process_signal(freq=400, fs=500, noise_level=0.0)
    assert result["aliased"] is True
    assert result["alias_freq"] > 0


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
