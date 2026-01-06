# Bootstrap Script Testing

This document describes how to test the `bootstrap` script in a clean environment.

## Overview

The `bootstrap` script is designed to set up dotfiles on a new machine by:
1. Cloning the dotfiles repository to `$HOME/dotfiles`
2. Running the `up` script to complete the setup

Testing this script requires a clean environment to properly validate the clone and setup workflow.

## Testing Methods

### 1. Local Docker Testing (Recommended)

Use Docker to test in a completely isolated environment that simulates a fresh machine.

#### Prerequisites
- Docker Desktop installed and running

#### Run Tests

```bash
# Run the test script
./test-bootstrap.sh

# Run with cleanup (removes Docker image after testing)
./test-bootstrap.sh --cleanup

# Show help
./test-bootstrap.sh --help
```

#### What Gets Tested
- Script syntax validation
- Script executability
- Basic error handling
- Script structure and logic

#### Limitations
- Cannot fully test the git clone operation without SSH keys
- Does not test the complete `up` script execution (requires Homebrew and other dependencies)

### 2. GitHub Actions CI

Automated testing runs on every push or pull request that modifies:
- `bootstrap`
- `up`
- `.github/workflows/test-bootstrap.yml`

#### What Gets Tested
- Bash syntax check (`bash -n bootstrap`)
- Script structure validation
- Function existence verification
- Script executability

#### View Test Results
Check the "Actions" tab in the GitHub repository to see test results.

### 3. Manual Testing on a Fresh Machine

For comprehensive end-to-end testing, you can test on:
- A fresh VM or cloud instance
- A new macOS installation
- Using the remote curl method

#### Remote Installation Test

```bash
# Test remote installation (requires public repository)
curl https://raw.githubusercontent.com/chloe463/dotfiles/refs/heads/main/bootstrap | bash
```

#### Local Installation Test

```bash
# Clone the repository
cd $HOME
git clone git@github.com:chloe463/dotfiles.git

# Run bootstrap
cd dotfiles
./bootstrap
```

## Test Files

### `Dockerfile.test`
Defines a minimal Ubuntu environment for testing:
- Base: Ubuntu 22.04
- Packages: git, curl, sudo, zsh
- User: testuser (non-root)
- Git config: Pre-configured for test operations

### `test-bootstrap.sh`
Shell script that:
- Builds the Docker test image
- Runs the bootstrap script in a container
- Validates basic functionality
- Cleans up resources

### `.github/workflows/test-bootstrap.yml`
GitHub Actions workflow that:
- Triggers on push/PR to main branch
- Checks script syntax
- Validates script structure
- Runs basic verification tests

## Troubleshooting

### Docker Daemon Not Running

**Error:**
```
ERROR: Cannot connect to the Docker daemon at unix:///var/run/docker.sock
```

**Solution:**
Start Docker Desktop and wait for it to fully initialize.

### SSH Key Issues

**Expected behavior:**
When testing in Docker, you'll see:
```
Host key verification failed.
fatal: Could not read from remote repository.
```

This is normal - the test environment doesn't have SSH keys configured. The test verifies the script handles this error correctly.

### Permission Denied

**Error:**
```
bash: ./test-bootstrap.sh: Permission denied
```

**Solution:**
```bash
chmod +x test-bootstrap.sh
```

## Best Practices

1. **Always run local tests** before pushing changes to the bootstrap script
2. **Check GitHub Actions** results after pushing
3. **Test on a real machine** periodically to ensure end-to-end functionality
4. **Update this document** when adding new test scenarios

## Future Improvements

Potential enhancements to the testing setup:

- [ ] Add integration tests for the `up` script
- [ ] Mock Homebrew installation in tests
- [ ] Test with both SSH and HTTPS git clone methods
- [ ] Add tests for different operating systems (macOS, Linux)
- [ ] Implement test coverage reporting
