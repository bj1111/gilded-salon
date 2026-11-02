"""Main file for generating results for Sticky Fruits."""

import shutil

from gamestate import GameState
from game_config import GameConfig
from game_optimization import OptimizationSetup
from natural_weights import write_natural_lookup
from optimization_program.run_script import OptimizationExecution
from utils.game_analytics.run_analysis import create_stat_sheet
from utils.rgs_verification import execute_all_tests
from src.state.run_sims import create_books
from src.write_data.write_configs import generate_configs

if __name__ == "__main__":

    num_threads = 8
    rust_threads = 16
    batching_size = 5000
    compression = True
    profiling = False

    # base is published and not re-simulated (its books and lookup table stay byte-identical);
    # add "base": int(2e5) here to rebuild it.
    # hunt is published at 2e5 and not re-simulated here; add it back to rebuild it.
    num_sim_args = {
        "bonus": int(1e5),
        "super": int(1e5),
    }

    # "natural": weight each round by its real probability (see natural_weights.py).
    # "optimizer": the SDK's Rust optimizer, which reshapes the win distribution.
    weighting = "natural"

    run_conditions = {
        "run_sims": True,
        "run_optimization": weighting == "optimizer",
        "run_analysis": True,
        "run_format_checks": True,
    }
    assert not run_conditions["run_optimization"] or shutil.which("cargo"), "optimizer needs Rust/cargo"
    target_modes = list(num_sim_args.keys())

    config = GameConfig()
    gamestate = GameState(config)
    if run_conditions["run_optimization"] or run_conditions["run_analysis"]:
        optimization_setup_class = OptimizationSetup(config)

    if run_conditions["run_sims"]:
        create_books(
            gamestate,
            config,
            num_sim_args,
            batching_size,
            num_threads,
            compression,
            profiling,
        )

    generate_configs(gamestate)

    if run_conditions["run_optimization"]:
        OptimizationExecution().run_all_modes(config, target_modes, rust_threads)
        generate_configs(gamestate)
    elif weighting == "natural":
        for mode in target_modes:
            write_natural_lookup(config, mode)  # also sets the solved price of bought modes
        generate_configs(gamestate)  # config.json records the lookup tables' hashes and costs

    if run_conditions["run_analysis"]:
        custom_keys = [{"symbol": "scatter"}]
        create_stat_sheet(gamestate, custom_keys=custom_keys)

    if run_conditions["run_format_checks"]:
        execute_all_tests(config)
