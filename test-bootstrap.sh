#!/usr/bin/env bash
#
# Test script for bootstrap
#
# This script builds a Docker image and tests the bootstrap script
# in a clean environment to ensure it works correctly.

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly IMAGE_NAME="dotfiles-bootstrap-test"
readonly CONTAINER_NAME="dotfiles-test-$(date +%s)"

# Color output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Print informational message
info() {
    echo -e "${GREEN}==>${NC} ${1}"
}

# Print warning message
warn() {
    echo -e "${YELLOW}Warning:${NC} ${1}"
}

# Print error message
error() {
    echo -e "${RED}ERROR:${NC} ${1}" >&2
}

# Cleanup function to remove container and image
cleanup() {
    info "Cleaning up..."

    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
    fi

    if [ "${REMOVE_IMAGE:-0}" = "1" ]; then
        docker rmi "${IMAGE_NAME}" >/dev/null 2>&1 || true
    fi
}

# Build Docker image
build_image() {
    info "Building Docker image..."

    if ! docker build -f "${SCRIPT_DIR}/Dockerfile.test" -t "${IMAGE_NAME}" "${SCRIPT_DIR}"; then
        error "Failed to build Docker image"
        return 1
    fi

    info "Docker image built successfully"
}

# Run bootstrap test in container
run_test() {
    info "Starting test container..."

    # Test the bootstrap script with HTTPS clone (SSH not available in container)
    # Use --skip-up flag to skip the lengthy 'up' script execution
    if ! docker run --name "${CONTAINER_NAME}" "${IMAGE_NAME}" \
        bash -c "
            set -e
            echo '==> Testing bootstrap script...'
            echo '==> Running bootstrap with HTTPS fallback (skipping up script)...'

            # Run bootstrap script with --skip-up flag
            /tmp/bootstrap --skip-up

            # Verify clone was successful
            if [ ! -d /home/testuser/dotfiles ]; then
                echo 'ERROR: dotfiles directory was not created'
                exit 1
            fi

            # Verify git repository was cloned
            if [ ! -d /home/testuser/dotfiles/.git ]; then
                echo 'ERROR: dotfiles is not a git repository'
                exit 1
            fi

            # Verify up script exists
            if [ ! -f /home/testuser/dotfiles/up ]; then
                echo 'ERROR: up script not found in cloned repository'
                exit 1
            fi

            echo '==> Bootstrap test completed successfully!'
            echo '==> Repository cloned to /home/testuser/dotfiles'
            echo '==> All validation checks passed'
        "; then
        error "Test failed"
        return 1
    fi

    info "Test completed successfully!"
}

# Main function
main() {
    local remove_image=0

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --cleanup)
                remove_image=1
                shift
                ;;
            --help)
                echo "Usage: $0 [--cleanup] [--help]"
                echo ""
                echo "Options:"
                echo "  --cleanup    Remove Docker image after testing"
                echo "  --help       Show this help message"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done

    # Set cleanup flag
    export REMOVE_IMAGE="${remove_image}"

    # Set up cleanup trap
    trap cleanup EXIT

    info "Starting bootstrap test"
    info "Working directory: ${SCRIPT_DIR}"

    # Check if Docker is available
    if ! command -v docker >/dev/null 2>&1; then
        error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    # Build and test
    build_image
    run_test

    info "All tests passed! ✓"
}

main "$@"
