"""
AliasingViz 3D – Signal Processing Engine
Core signal generation, sampling, reconstruction, and analysis.
"""

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

    Returns:
        (t_sampled, y_sampled)
    """
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

    Returns:
        (alias_freq, is_aliased) – the apparent frequency and whether aliasing occurs
    """
    nyquist = fs / 2.0
    is_aliased = freq > nyquist

    if not is_aliased:
        return freq, False

    # Fold the frequency back into [0, fs/2]
    alias_freq = abs(freq - round(freq / fs) * fs)
    if alias_freq > nyquist:
        alias_freq = fs - alias_freq

    return alias_freq, True


# ─── Reconstruction (Sinc Interpolation) ─────────────────────────────

def reconstruct_signal(
    t_sampled: np.ndarray,
    y_sampled: np.ndarray,
    t_continuous: np.ndarray,
) -> np.ndarray:
    """
    Reconstruct a signal from samples using sinc interpolation
    (Whittaker-Shannon interpolation formula).
    """
    if len(t_sampled) < 2:
        return np.zeros_like(t_continuous)

    Ts = t_sampled[1] - t_sampled[0]  # Sampling period
    y_reconstructed = np.zeros_like(t_continuous)

    for n, (tn, yn) in enumerate(zip(t_sampled, y_sampled)):
        y_reconstructed += yn * np.sinc((t_continuous - tn) / Ts)

    return y_reconstructed


# ─── FFT ──────────────────────────────────────────────────────────────

def compute_fft(
    signal: np.ndarray,
    sample_rate: float,
    max_bins: int = 128,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Compute the FFT of a signal.

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
    """
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

    return {
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
