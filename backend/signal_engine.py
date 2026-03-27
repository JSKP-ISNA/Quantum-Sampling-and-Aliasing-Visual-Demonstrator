"""
AliasingViz 3D – Signal Processing Engine
Core signal generation, sampling, reconstruction, and analysis.
"""

import functools
import hashlib
import json

import numpy as np
from scipy import signal as scipy_signal
from scipy.interpolate import interp1d


# ─── Signal Generation ───────────────────────────────────────────────

def generate_signal(
    freq: float,
    duration: float = 0.05,
    sample_rate: float = 10000.0,
    wave_type: str = "sine",
    amplitude: float = 1.0,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Generate a continuous-time signal.

    Returns:
        (t, signal) – time array and amplitude array
    """
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)

    if wave_type == "sine":
        y = amplitude * np.sin(2 * np.pi * freq * t)
    elif wave_type == "square":
        y = amplitude * scipy_signal.square(2 * np.pi * freq * t)
    elif wave_type == "sawtooth":
        y = amplitude * scipy_signal.sawtooth(2 * np.pi * freq * t)
    elif wave_type == "triangle":
        y = amplitude * scipy_signal.sawtooth(2 * np.pi * freq * t, width=0.5)
    else:
        y = amplitude * np.sin(2 * np.pi * freq * t)

    return t, y


# ─── Sampling ─────────────────────────────────────────────────────────

def sample_signal(
    t_continuous: np.ndarray,
    signal: np.ndarray,
    fs: float,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Sample a continuous signal at sampling frequency fs.

    Uses the true signal duration (derived from the time step and number of
    points) rather than t_continuous[-1], which is one step short of the
    full duration when endpoint=False is used in generate_signal.

    Returns:
        (t_sampled, y_sampled)
    """
    # Compute the true signal duration from the step size
    if len(t_continuous) >= 2:
        dt = t_continuous[1] - t_continuous[0]
        duration = dt * len(t_continuous)
    else:
        duration = t_continuous[-1]

    num_samples = max(int(fs * duration), 2)
    t_sampled = np.linspace(0, duration, num_samples, endpoint=False)

    # Interpolate the continuous signal at sample points
    interpolator = interp1d(t_continuous, signal, kind="linear", fill_value="extrapolate")
    y_sampled = interpolator(t_sampled)

    return t_sampled, y_sampled


# ─── Noise ────────────────────────────────────────────────────────────

def add_noise(signal: np.ndarray, noise_level: float = 0.0) -> np.ndarray:
    """Add Gaussian noise to a signal."""
    if noise_level <= 0:
        return signal.copy()
    noise = np.random.normal(0, noise_level, len(signal))
    return signal + noise


# ─── Alias Frequency ─────────────────────────────────────────────────

def get_alias_frequency(freq: float, fs: float) -> tuple[float, bool]:
    """
    Calculate the alias frequency using the Nyquist theorem.
    Uses iterative folding to guarantee the result is in [0, fs/2].

    Returns:
        (alias_freq, is_aliased) – the apparent frequency and whether aliasing occurs
    """
    nyquist = fs / 2.0
    is_aliased = freq > nyquist

    if not is_aliased:
        return freq, False

    # Fold into [0, fs/2] — standard alias formula
    alias_freq = freq % fs
    if alias_freq > nyquist:
        alias_freq = fs - alias_freq

    return alias_freq, True


# ─── Reconstruction (Sinc Interpolation) ─────────────────────────────

def reconstruct_signal(
    t_sampled,
    y_sampled,
    t_continuous,
) -> np.ndarray:
    """
    Reconstruct a signal from samples using sinc interpolation
    (Whittaker-Shannon interpolation formula) – vectorized version.
    """
    if len(t_sampled) < 2:
        return np.zeros_like(t_continuous)

    Ts = t_sampled[1] - t_sampled[0]  # Sampling period

    # Create matrix of (t - tn) / Ts  — shape: (len_t_cont, len_t_samp)
    t_matrix = (t_continuous[:, None] - t_sampled[None, :]) / Ts

    # Apply sinc and perform weighted sum via dot product
    y_reconstructed = np.sinc(t_matrix) @ y_sampled

    return y_reconstructed

# ─── FFT ──────────────────────────────────────────────────────────────

def compute_fft(
    signal: np.ndarray,
    sample_rate: float,
    max_bins: int = 512,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Compute the FFT of a signal.

    Args:
        signal: Input signal array
        sample_rate: Sample rate in Hz
        max_bins: Maximum number of frequency bins to return (default 512).
                  Higher values preserve more high-frequency content at the
                  cost of larger payloads.

    Returns:
        (frequencies, magnitudes) – positive frequency side only, truncated to max_bins
    """
    n = len(signal)
    fft_vals = np.fft.rfft(signal)
    fft_mag = np.abs(fft_vals) / n * 2  # Normalized magnitude
    fft_freq = np.fft.rfftfreq(n, d=1.0 / sample_rate)

    # Truncate to max_bins for efficient transport
    limit = min(len(fft_freq), max_bins)
    return fft_freq[:limit], fft_mag[:limit]


# ─── Error Metrics ────────────────────────────────────────────────────

def compute_error(
    original: np.ndarray,
    reconstructed: np.ndarray,
) -> dict:
    """
    Compute error metrics between original and reconstructed signals.

    Returns:
        dict with mse, snr, max_error
    """
    diff = original - reconstructed
    mse = float(np.mean(diff ** 2))

    # Signal-to-Noise Ratio
    signal_power = float(np.mean(original ** 2))
    if signal_power > 1e-10:
        snr = float(10 * np.log10(signal_power / max(mse, 1e-10)))
    else:
        snr = 0.0

    max_error = float(np.max(np.abs(diff)))

    return {"mse": round(mse, 6), "snr": round(snr, 2), "max_error": round(max_error, 4)}


# ─── Result Caching ──────────────────────────────────────────────────

# Cache keyed on rounded parameters to avoid recomputation when
# sliders are held still or land on the same quantized value.
_cache: dict[str, dict] = {}
_CACHE_MAX = 64


def _make_cache_key(freq, fs, noise_level, wave_type, duration, max_points) -> str:
    """Create a stable cache key from rounded parameters."""
    key_data = (
        round(freq, 2),
        round(fs, 2),
        round(noise_level, 3),
        wave_type,
        round(duration, 4),
        max_points,
    )
    return str(key_data)


# ─── Full Pipeline ────────────────────────────────────────────────────

def process_signal(
    freq: float = 100.0,
    fs: float = 300.0,
    noise_level: float = 0.0,
    wave_type: str = "sine",
    duration: float = 0.05,
    max_points: int = 500,
) -> dict:
    """
    Run the full signal processing pipeline.

    Returns a dict with all data needed by the frontend.
    Caches results for identical (rounded) parameters to avoid redundant
    computation when sliders are held still.
    """
    global _cache

    # Check cache (skip for noisy signals since noise is non-deterministic)
    cache_key = None
    if noise_level <= 0:
        cache_key = _make_cache_key(freq, fs, noise_level, wave_type, duration, max_points)
        if cache_key in _cache:
            return _cache[cache_key]

    # 1. Generate continuous signal (high resolution)
    t_cont, y_cont = generate_signal(freq, duration, sample_rate=10000, wave_type=wave_type)

    # 2. Sample the signal
    t_samp, y_samp = sample_signal(t_cont, y_cont, fs)

    # 3. Add noise to samples
    y_samp_noisy = add_noise(y_samp, noise_level)

    # 4. Get alias frequency
    alias_freq, is_aliased = get_alias_frequency(freq, fs)

    # 5. Reconstruct from noisy samples
    y_reconstructed = reconstruct_signal(t_samp, y_samp_noisy, t_cont)

    # 6. Compute FFT of original and sampled
    fft_freq_orig, fft_mag_orig = compute_fft(y_cont, 10000)
    fft_freq_samp, fft_mag_samp = compute_fft(y_samp_noisy, fs)

    # 7. Error metrics
    error_metrics = compute_error(y_cont, y_reconstructed)

    # 8. Generate alias ghost signal (if aliased)
    if is_aliased:
        _, y_alias_ghost = generate_signal(alias_freq, duration, sample_rate=10000, wave_type="sine")
    else:
        y_alias_ghost = np.zeros_like(t_cont)

    # Downsample for transport (keep max_points points)
    step = max(1, len(t_cont) // max_points)
    t_out = t_cont[::step]
    y_out = y_cont[::step]
    y_recon_out = y_reconstructed[::step]
    y_ghost_out = y_alias_ghost[::step]

    result = {
        "signal": {
            "t": t_out.tolist(),
            "y": y_out.tolist(),
        },
        "sampled": {
            "t": t_samp.tolist(),
            "y": y_samp_noisy.tolist(),
        },
        "reconstructed": {
            "t": t_out.tolist(),
            "y": y_recon_out.tolist(),
        },
        "alias_ghost": {
            "t": t_out.tolist(),
            "y": y_ghost_out.tolist(),
        },
        "fft": {
            "original": {
                "freq": fft_freq_orig.tolist(),
                "magnitude": fft_mag_orig.tolist(),
            },
            "sampled": {
                "freq": fft_freq_samp.tolist(),
                "magnitude": fft_mag_samp.tolist(),
            },
        },
        "alias_freq": round(alias_freq, 2),
        "aliased": is_aliased,
        "error": error_metrics,
        "params": {
            "freq": freq,
            "fs": fs,
            "noise_level": noise_level,
            "wave_type": wave_type,
            "nyquist": fs / 2.0,
        },
    }

    # Store in cache (with eviction)
    if cache_key is not None:
        if len(_cache) >= _CACHE_MAX:
            # Evict oldest entry
            oldest_key = next(iter(_cache))
            del _cache[oldest_key]
        _cache[cache_key] = result

    return result
