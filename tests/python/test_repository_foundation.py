from pathlib import Path


def test_approved_top_level_directories_exist() -> None:
    repository_root = Path(__file__).resolve().parents[2]
    expected_directories = {
        "ai",
        "apps",
        "assets",
        "backend",
        "docs",
        "infrastructure",
        "packages",
        "scripts",
        "tests",
        "tools",
    }

    assert all((repository_root / directory).is_dir() for directory in expected_directories)
