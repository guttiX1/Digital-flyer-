// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Registry for horse racing stable (cuadra) names tied to wallet addresses.
contract CuadraRegistry {
    mapping(address => string) public cuadraOf;
    mapping(bytes32 => address) private _nameOwner;

    event CuadraRegistered(address indexed owner, string name);
    event CuadraUpdated(address indexed owner, string oldName, string newName);

    modifier validName(string calldata name) {
        uint256 len = bytes(name).length;
        require(len >= 2 && len <= 32, "name must be 2-32 chars");
        _;
    }

    function registerCuadra(string calldata name) external validName(name) {
        require(bytes(cuadraOf[msg.sender]).length == 0, "already registered");

        bytes32 key = keccak256(bytes(name));
        require(_nameOwner[key] == address(0), "name already taken");

        cuadraOf[msg.sender] = name;
        _nameOwner[key] = msg.sender;

        emit CuadraRegistered(msg.sender, name);
    }

    function updateCuadra(string calldata newName) external validName(newName) {
        string memory oldName = cuadraOf[msg.sender];
        require(bytes(oldName).length > 0, "not registered");

        bytes32 newKey = keccak256(bytes(newName));
        require(_nameOwner[newKey] == address(0), "name already taken");

        delete _nameOwner[keccak256(bytes(oldName))];
        cuadraOf[msg.sender] = newName;
        _nameOwner[newKey] = msg.sender;

        emit CuadraUpdated(msg.sender, oldName, newName);
    }

    function ownerOfCuadra(string calldata name) external view returns (address) {
        return _nameOwner[keccak256(bytes(name))];
    }

    function hasCuadra(address account) external view returns (bool) {
        return bytes(cuadraOf[account]).length > 0;
    }
}
