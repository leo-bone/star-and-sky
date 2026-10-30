// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Star & Sky Kingdom Pass
/// @notice 用户将其「星辰王国凭证」铸造为 ERC-721 上 BNB Smart Chain。
///         任何人可铸造到自己的地址；管理员可代铸给指定地址。
/// @dev OpenZeppelin Contracts v5：ERC721 已内建 URI 存储（无需 ERC721URIStorage）。
contract StarSkyBSC is ERC721, Ownable {
    uint256 private _nextId;
    string private _base;

    constructor(address initialOwner, string memory baseURI)
        ERC721("Star & Sky Kingdom Pass", "SSKP")
        Ownable(initialOwner)
    {
        _base = baseURI;
    }

    /// @notice 任何人可将王国凭证铸造到自己的地址；uri 指向 IPFS 元数据
    function mint(string calldata uri) external returns (uint256) {
        uint256 id = _nextId;
        _nextId++;
        _safeMint(msg.sender, id);
        _setTokenURI(id, uri);
        return id;
    }

    /// @notice 管理员可代铸给指定地址（可选，用于赠送/补偿）
    function mintTo(address to, string calldata uri) external onlyOwner returns (uint256) {
        uint256 id = _nextId;
        _nextId++;
        _safeMint(to, id);
        _setTokenURI(id, uri);
        return id;
    }

    function _baseURI() internal view override returns (string memory) {
        return _base;
    }

    function tokenURI(uint256 id)
        public
        view
        override(ERC721)
        returns (string memory)
    {
        return super.tokenURI(id);
    }

    function supportsInterface(bytes4 id)
        public
        view
        override(ERC721)
        returns (bool)
    {
        return super.supportsInterface(id);
    }
}
