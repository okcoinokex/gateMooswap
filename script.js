// Gate Layer 网络配置
const NETWORK_CONFIG = {
    chainId: '0x2768', // 10088 in hex
    chainName: 'Gate Layer',
    nativeCurrency: {
        name: 'GT',
        symbol: 'GT',
        decimals: 18,
    },
    rpcUrls: ['https://gatelayer-mainnet.gatenode.cc'],
    blockExplorerUrls: ['https://www.gatescan.org/gatelayer/'],
};

// 合约地址配置 (Gate Layer网络)
const CONTRACT_ADDRESSES = {
    factory: '0xB864ada6Ad8e9b2823DD8dd8b42a0E8ED246BD1B',
    router: '0xBC978BfDb2bfa3829fB1c3f39c61A8550B7C88E5',
    // Gate Layer网络代币地址 (需要根据实际部署更新)
    WGT: '0x6803b8E93b13941F6B73b82E324B80251B3dE338', // Wrapped GT
    USDC: '0x0000000000000000000000000000000000000000', // 需要更新为实际地址
    USDT: '0x0000000000000000000000000000000000000000'  // 需要更新为实际地址
};

// Gate Layer 常用代币列表
const COMMON_TOKENS = [
    {
        address: '0x57Cc62Ff694971f93C66baFE83E8862b7B109D75',
        symbol: 'GMOO',
        name: 'GMOO Token',
        decimals: 18,
        icon: 'GMOO.png'
    },
    {
        address: '0x0000000000000000000000000000000000000000',
        symbol: 'GT',
        name: 'Gate Token',
        decimals: 18,
        icon: 'gt-logo.png'
    },
    {
        address: CONTRACT_ADDRESSES.WGT,
        symbol: 'WGT',
        name: 'Wrapped Gate Token',
        decimals: 18,
        icon: 'gt-logo.png'
    }
];

// ERC20 标准接口 ABI
const ERC20_ABI = [
    {
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "recipient", "type": "address"}, {"internalType": "uint256", "name": "amount", "type": "uint256"}],
        "name": "transfer",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "owner", "type": "address"}, {"internalType": "address", "name": "spender", "type": "address"}],
        "name": "allowance",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "spender", "type": "address"}, {"internalType": "uint256", "name": "amount", "type": "uint256"}],
        "name": "approve",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "sender", "type": "address"}, {"internalType": "address", "name": "recipient", "type": "address"}, {"internalType": "uint256", "name": "amount", "type": "uint256"}],
        "name": "transferFrom",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "name",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function"
    }
];

// 全局变量
let web3;
let userAccount;
let currentTab = 'swap';
let selectedTokenType = null; // 'from', 'to', 'liquidityA', 'liquidityB'
let slippage = 25; // 默认滑点 25%
let deadline = 20; // 默认截止时间 20分钟
let currentWallet = null; // 当前连接的钱包信息

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 检查代币授权额度（优化版）
async function checkTokenAllowance(tokenAddress, spenderAddress, amount) {
    try {
        if (!web3 || !userAccount) {
            console.log('Web3或用户账户未连接');
            return false;
        }
        if (tokenAddress === '0x0000000000000000000000000000000000000000') {
            console.log('GT代币不需要授权');
            return true;
        }

        // 确保地址格式正确
        const ownerAddress = web3.utils.toChecksumAddress(userAccount);
        const spenderAddressChecksum = web3.utils.toChecksumAddress(spenderAddress);
        const tokenAddressChecksum = web3.utils.toChecksumAddress(tokenAddress);
        
        console.log('检查授权额度:', {
            tokenAddress: tokenAddressChecksum,
            spenderAddress: spenderAddressChecksum,
            ownerAddress: ownerAddress,
            requiredAmount: amount
        });
        
        const allowance = await web3.eth.call({
            to: tokenAddressChecksum,
            data: web3.eth.abi.encodeFunctionCall({
                name: 'allowance',
                type: 'function',
                inputs: [
                    { type: 'address', name: 'owner' },
                    { type: 'address', name: 'spender' }
                ]
            }, [ownerAddress, spenderAddressChecksum])
        });

        // 直接比较Wei格式的字符串
        const hasEnoughAllowance = BigInt(allowance) >= BigInt(amount);
        
        console.log('授权额度检查结果:', {
            currentAllowance: allowance,
            requiredAmount: amount,
            hasEnoughAllowance: hasEnoughAllowance
        });

        return hasEnoughAllowance;
    } catch (error) {
        console.error('检查授权额度失败:', error);
        return false;
    }
}

// 授权代币（优化版）
// 使用最大授权值进行授权
async function approveTokenMax(tokenAddress, spenderAddress) {
    try {
        if (!web3 || !userAccount) {
            console.log('Web3或用户账户未连接');
            return false;
        }
        
        if (tokenAddress === '0x0000000000000000000000000000000000000000') {
            console.log('GT代币不需要授权');
            return true;
        }

        const ownerAddress = web3.utils.toChecksumAddress(userAccount);
        const spenderAddressChecksum = web3.utils.toChecksumAddress(spenderAddress);
        const tokenAddressChecksum = web3.utils.toChecksumAddress(tokenAddress);
        
        console.log('开始最大授权:', {
            tokenAddress: tokenAddressChecksum,
            spenderAddress: spenderAddressChecksum,
            ownerAddress: ownerAddress
        });
        
        // 使用最大uint256值进行授权
        const maxAmount = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        
        const tx = await web3.eth.sendTransaction({
            from: ownerAddress,
            to: tokenAddressChecksum,
            data: web3.eth.abi.encodeFunctionCall({
                name: 'approve',
                type: 'function',
                inputs: [
                    {type: 'address', name: 'spender'},
                    {type: 'uint256', name: 'amount'}
                ]
            }, [spenderAddressChecksum, maxAmount]),
            gas: 100000
        });
        
        console.log('授权交易已发送:', tx.transactionHash);
        
        // 等待交易确认
        const receipt = await web3.eth.getTransactionReceipt(tx.transactionHash);
        if (receipt.status) {
            console.log('授权成功');
            return true;
        } else {
            console.log('授权失败');
            return false;
        }
        
    } catch (error) {
        console.error('Token授权失败:', error);
        return false;
    }
}

async function approveToken(tokenAddress, spenderAddress, amount) {
    try {
        if (!web3 || !userAccount) throw new Error('Web3或用户账户未连接');

        const amountWei = web3.utils.toWei(amount, 'ether');
        const approvalMessage = currentLanguage === 'zh' ? '正在授权代币...' : 'Approving token...';
        showLoading(true, approvalMessage);
        showNotification(approvalMessage, 'info');

        // 确保地址格式正确
        const fromAddress = web3.utils.toChecksumAddress(userAccount);
        const tokenAddressChecksum = web3.utils.toChecksumAddress(tokenAddress);
        const spenderAddressChecksum = web3.utils.toChecksumAddress(spenderAddress);

        console.log('授权参数:', {
            from: fromAddress,
            to: tokenAddressChecksum,
            spender: spenderAddressChecksum,
            amount: amountWei
        });

        // 使用直接调用方式，避免创建合约实例
        const tx = await web3.eth.sendTransaction({
            from: fromAddress,
            to: tokenAddressChecksum,
            data: web3.eth.abi.encodeFunctionCall({
                name: 'approve',
                type: 'function',
                inputs: [
                    { type: 'address', name: 'spender' },
                    { type: 'uint256', name: 'amount' }
                ]
            }, [spenderAddressChecksum, amountWei]),
            gas: 100000
        });

        console.log('授权交易成功:', tx);
        const successMessage = currentLanguage === 'zh' ? '代币授权成功！' : 'Token approved successfully!';
        showNotification(successMessage, 'success');
        return true;

    } catch (error) {
        console.error('授权代币失败:', error);
        const errorMessage = currentLanguage === 'zh' ? 
            '代币授权失败: ' + error.message : 
            'Token approval failed: ' + error.message;
        showNotification(errorMessage, 'error');
        return false;
    } finally {
        showLoading(false);
    }
}

// 全局测试函数
window.testSearch = function(address) {
    console.log('手动测试搜索:', address);
    const searchInput = document.getElementById('tokenSearch');
    if (searchInput) {
        searchInput.value = address;
        handleTokenSearch();
    } else {
        console.error('未找到搜索输入框');
    }
};

// 显示双语通知 - Neumorphic风格
function showNotification(message, type = 'info') {
    // 如果message是对象，包含中英文
    if (typeof message === 'object' && message.zh && message.en) {
        message = currentLanguage === 'zh' ? message.zh : message.en;
    }
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Neumorphic风格样式 - 和swap界面保持一致
    const colors = {
        success: '#22c55e',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(33, 33, 33, 0.6);
        color: #fff;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        border: 2px solid #212121;
        box-shadow: 6px 6px 10px rgba(0,0,0,1),
        1px 1px 10px rgba(255, 255, 255, 0.6);
        backdrop-filter: blur(10px);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-weight: 500;
        font-size: 14px;
        transform: translateX(100%);
        transition: all 0.3s ease;
        max-width: 350px;
        word-wrap: break-word;
    `;
    
    // 根据类型设置图标颜色
    const icon = notification.querySelector('i');
    icon.style.color = colors[type] || colors.info;
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 显示动画
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // 自动隐藏
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}


// Factory合约ABI (Uniswap V2 Factory)
const FACTORY_ABI = [
    {
        "constant": true,
        "inputs": [
            {"name": "tokenA", "type": "address"},
            {"name": "tokenB", "type": "address"}
        ],
        "name": "getPair",
        "outputs": [{"name": "", "type": "address"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "allPairsLength",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    }
];

// Pair合约ABI (Uniswap V2 Pair)
const PAIR_ABI = [
    {
        "constant": true,
        "inputs": [],
        "name": "getReserves",
        "outputs": [
            {"name": "_reserve0", "type": "uint112"},
            {"name": "_reserve1", "type": "uint112"},
            {"name": "_blockTimestampLast", "type": "uint32"}
        ],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "token0",
        "outputs": [{"name": "", "type": "address"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "token1",
        "outputs": [{"name": "", "type": "address"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    }
];

// WGT合约ABI (包含包装和解包功能)
const WGT_ABI = [
    ...ERC20_ABI,
    {
        "constant": false,
        "inputs": [],
        "name": "deposit",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {"name": "wad", "type": "uint256"}
        ],
        "name": "withdraw",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

// Router ABI (简化版)
const ROUTER_ABI = [
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountOutMin", "type": "uint256"},
            {"internalType": "address[]", "name": "path", "type": "address[]"},
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"}
        ],
        "name": "swapExactETHForTokens",
        "outputs": [
            {"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}
        ],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
            {"internalType": "uint256", "name": "amountOutMin", "type": "uint256"},
            {"internalType": "address[]", "name": "path", "type": "address[]"},
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"}
        ],
        "name": "swapExactTokensForETH",
        "outputs": [
            {"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
            {"internalType": "uint256", "name": "amountOutMin", "type": "uint256"},
            {"internalType": "address[]", "name": "path", "type": "address[]"},
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"}
        ],
        "name": "swapExactTokensForTokens",
        "outputs": [
            {"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "tokenA", "type": "address"},
            {"internalType": "address", "name": "tokenB", "type": "address"},
            {"internalType": "uint256", "name": "amountADesired", "type": "uint256"},
            {"internalType": "uint256", "name": "amountBDesired", "type": "uint256"},
            {"internalType": "uint256", "name": "amountAMin", "type": "uint256"},
            {"internalType": "uint256", "name": "amountBMin", "type": "uint256"},
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"}
        ],
        "name": "addLiquidity",
        "outputs": [
            {"internalType": "uint256", "name": "amountA", "type": "uint256"},
            {"internalType": "uint256", "name": "amountB", "type": "uint256"},
            {"internalType": "uint256", "name": "liquidity", "type": "uint256"}
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "token", "type": "address"},
            {"internalType": "uint256", "name": "amountTokenDesired", "type": "uint256"},
            {"internalType": "uint256", "name": "amountTokenMin", "type": "uint256"},
            {"internalType": "uint256", "name": "amountETHMin", "type": "uint256"},
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"}
        ],
        "name": "addLiquidityETH",
        "outputs": [
            {"internalType": "uint256", "name": "amountToken", "type": "uint256"},
            {"internalType": "uint256", "name": "amountETH", "type": "uint256"},
            {"internalType": "uint256", "name": "liquidity", "type": "uint256"}
        ],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
            {"internalType": "address[]", "name": "path", "type": "address[]"}
        ],
        "name": "getAmountsOut",
        "outputs": [
            {"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "tokenA", "type": "address"},
            {"internalType": "address", "name": "tokenB", "type": "address"},
            {"internalType": "uint256", "name": "liquidity", "type": "uint256"},
            {"internalType": "uint256", "name": "amountAMin", "type": "uint256"},
            {"internalType": "uint256", "name": "amountBMin", "type": "uint256"},
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"}
        ],
        "name": "removeLiquidity",
        "outputs": [
            {"internalType": "uint256", "name": "amountA", "type": "uint256"},
            {"internalType": "uint256", "name": "amountB", "type": "uint256"}
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "token", "type": "address"},
            {"internalType": "uint256", "name": "liquidity", "type": "uint256"},
            {"internalType": "uint256", "name": "amountTokenMin", "type": "uint256"},
            {"internalType": "uint256", "name": "amountETHMin", "type": "uint256"},
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"}
        ],
        "name": "removeLiquidityETH",
        "outputs": [
            {"internalType": "uint256", "name": "amountToken", "type": "uint256"},
            {"internalType": "uint256", "name": "amountETH", "type": "uint256"}
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    setupEventListeners();
    await initializeWeb3();
    updateTokenList();
    
    // 设置默认代币
    setDefaultTokens();
    
    // 初始化钱包状态显示
    updateWalletStatus();
    
    // 初始化滑点显示
    const slippageDisplay = document.getElementById('slippage');
    if (slippageDisplay) {
        slippageDisplay.textContent = slippage + '%';
        console.log('应用初始化滑点显示:', slippage + '%');
    }
    
    // 初始化默认代币的余额显示
    if (userAccount && web3) {
        const defaultFromToken = {
            address: '0x0000000000000000000000000000000000000000',
            symbol: 'GT',
            name: 'Gate Token',
            decimals: 18,
            icon: 'gt-logo.png'
        };
        const defaultToToken = {
            address: CONTRACT_ADDRESSES.WGT,
            symbol: 'WGT',
            name: 'Wrapped Gate Token',
            decimals: 18,
            icon: 'gt-logo.png'
        };
        
        // 余额默认显示0，查到了再更新
        const balanceText = currentLanguage === 'zh' ? '余额: 0' : 'Balance: 0';
        document.getElementById('fromBalance').textContent = balanceText;
        document.getElementById('liquidityABalance').textContent = balanceText;
        document.getElementById('liquidityBBalance').textContent = balanceText;
        
        // 异步更新余额
        updateBalance('fromBalance', defaultFromToken);
        updateBalance('liquidityABalance', defaultFromToken);
        updateBalance('liquidityBBalance', defaultToToken);
        
        // 初始化代币选择器显示
        updateTokenDisplay('fromTokenSelect', defaultFromToken);
        // 不设置toTokenSelect的默认值，让用户自己选择
        // 设置liquidityATokenSelect默认为GT，liquidityBTokenSelect让用户自己选择
        updateTokenDisplay('liquidityATokenSelect', defaultFromToken);
        
        // 延迟检查流动性表单，确保DOM完全加载
        setTimeout(() => {
            checkLiquidityForm();
            // 强制刷新按钮状态
            forceRefreshLiquidityButton();
        }, 200);
        
        // 额外的延迟检查，确保按钮状态正确
        setTimeout(() => {
            forceRefreshLiquidityButton();
        }, 1000);
        
        // 强制设置按钮样式，确保与swap按钮一致
        setTimeout(() => {
            const addLiquidityBtn = document.getElementById('addLiquidityBtn');
            if (addLiquidityBtn) {
                console.log('强制设置按钮样式 - 当前状态:', {
                    className: addLiquidityBtn.className,
                    innerHTML: addLiquidityBtn.innerHTML,
                    disabled: addLiquidityBtn.disabled
                });
                
                // 确保按钮有正确的样式类 - 统一使用基础样式
                addLiquidityBtn.className = 'liquidity-action-btn';
                
                console.log('强制设置按钮样式 - 修复后状态:', {
                    className: addLiquidityBtn.className,
                    innerHTML: addLiquidityBtn.innerHTML,
                    disabled: addLiquidityBtn.disabled
                });
            }
        }, 1500);
    }
}

// 设置默认代币
function setDefaultTokens() {
    const defaultFromToken = {
        address: '0x0000000000000000000000000000000000000000',
        symbol: 'GT',
        name: 'Gate Token',
        decimals: 18,
        icon: 'gt-logo.png'
    };
    
    console.log('设置默认代币:', defaultFromToken);
    
    // 只设置默认的"从"代币（GT）
    updateTokenDisplay('fromTokenSelect', defaultFromToken);
    document.getElementById('fromTokenSelect').dataset.token = JSON.stringify(defaultFromToken);
    
    // "到"代币不设置默认值，显示"选择代币"按钮
    // 不设置toTokenSelect的dataset.token，保持为undefined
    
    console.log('默认代币设置完成:', {
        fromToken: document.getElementById('fromTokenSelect').dataset.token,
        toToken: document.getElementById('toTokenSelect').dataset.token
    });
}

// 设置事件监听器
function setupEventListeners() {
    // 检查导航按钮是否存在
    const navButtons = document.querySelectorAll('.nav-btn');
    console.log('找到的导航按钮数量:', navButtons.length); // 调试日志
    
    navButtons.forEach((btn, index) => {
        const tab = btn.dataset.tab;
        console.log(`按钮 ${index}:`, tab, btn); // 调试日志
    });
    
    // 导航按钮
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.currentTarget.dataset.tab;
            console.log('点击了导航按钮:', tab); // 调试日志
            switchTab(tab);
            // 在移动端点击后关闭菜单
            closeMobileMenu();
        });
    });

    // 移动端菜单按钮
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    console.log('移动端菜单按钮元素:', mobileMenuBtn); // 调试日志
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
        console.log('移动端菜单按钮事件监听器已添加'); // 调试日志
    } else {
        console.error('找不到移动端菜单按钮元素'); // 调试日志
    }

    // 语言切换按钮
    document.getElementById('languageBtn').addEventListener('click', toggleLanguage);

    // 连接钱包按钮
    document.getElementById('connectWallet').addEventListener('click', connectWallet);
    
    // 网络切换按钮 - 自动添加网络并切换
    document.getElementById('networkBtn').addEventListener('click', async () => {
        await switchNetwork();
        // 切换后检查网络状态
        setTimeout(() => {
            checkNetworkStatus();
        }, 1000);
    });

    // 代币选择按钮
    document.getElementById('fromTokenSelect').addEventListener('click', () => {
        console.log('点击fromTokenSelect');
        openTokenModal('from');
    });
    document.getElementById('toTokenSelect').addEventListener('click', () => {
        console.log('点击toTokenSelect');
        openTokenModal('to');
    });
    document.getElementById('liquidityATokenSelect').addEventListener('click', () => {
        console.log('点击liquidityATokenSelect');
        openTokenModal('liquidityA');
    });
    document.getElementById('liquidityBTokenSelect').addEventListener('click', () => {
        console.log('点击liquidityBTokenSelect');
        openTokenModal('liquidityB');
    });
    
    // 搜索流动性池的代币选择器
    document.getElementById('searchTokenASelect').addEventListener('click', () => {
        console.log('点击searchTokenASelect');
        openTokenModal('searchTokenA');
    });
    document.getElementById('searchTokenBSelect').addEventListener('click', () => {
        console.log('点击searchTokenBSelect');
        openTokenModal('searchTokenB');
    });

    // 关闭模态框
    document.getElementById('closeTokenModal').addEventListener('click', closeTokenModal);
    document.getElementById('closeSettingsModal').addEventListener('click', closeSettingsModal);

    // 设置按钮
    document.getElementById('swapSettings').addEventListener('click', () => {
        // 使用翻转机制而不是模态框
        document.getElementById('swap_toggle').checked = true;
    });
    document.getElementById('liquiditySettings').addEventListener('click', () => openSettingsModal('liquidity'));

    // 滑点选择 - 自动保存（使用事件委托）
    document.addEventListener('DOMContentLoaded', function() {
        console.log('=== DOM加载完成，开始初始化滑点按钮 ===');

        // 查找所有滑点按钮
        const buttons = document.querySelectorAll('.slippage-btn');
        console.log('找到滑点按钮数量:', buttons.length);

        // 显示初始状态
        console.log('=== 初始状态 ===');
        buttons.forEach(b => {
            console.log(`按钮 ${b.textContent}: active=${b.classList.contains('active')}`);
        });
    });

    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('slippage-btn')) {
            console.log('=== 滑点按钮被点击 ===');
            e.preventDefault();
            e.stopPropagation();

            console.log('点击的按钮:', e.target.textContent, e.target.dataset.slippage);

            // 找到当前按钮所在的容器
            const container = e.target.closest('.slippage-options');
            console.log('按钮所在容器:', container);

            // 移除同一容器内所有按钮的active类
            if (container) {
                const containerButtons = container.querySelectorAll('.slippage-btn');
                console.log('容器内按钮数量:', containerButtons.length);
                containerButtons.forEach(b => {
                    b.classList.remove('active');
                    console.log('移除active类:', b.textContent);
                });
            }

            // 给当前按钮添加active类
            e.target.classList.add('active');
            console.log('添加active类:', e.target.textContent);

            // 更新价格信息区域的滑点显示
            const slippageValue = parseFloat(e.target.dataset.slippage);
            const slippageDisplay = document.getElementById('slippage');
            if (slippageDisplay) {
                slippageDisplay.textContent = slippageValue + '%';
                console.log('更新滑点显示:', slippageValue + '%');
            }

            // 验证最终状态
            console.log('=== 最终状态 ===');
            document.querySelectorAll('.slippage-btn').forEach(b => {
                console.log(`按钮 ${b.textContent}: active=${b.classList.contains('active')}`);
            });

            // 更新滑点值
            slippage = parseFloat(e.target.dataset.slippage);

            // 显示通知
            console.log('滑点设置已保存:', slippage + '%');
            showNotification({
                zh: `滑点已设置为 ${slippage}%`,
                en: `Slippage set to ${slippage}%`
            }, 'success');
        }
    });

    // 截止时间输入 - 自动保存
    document.getElementById('deadline').addEventListener('input', (e) => {
        deadline = parseInt(e.target.value);
        console.log('截止时间设置已自动保存:', deadline + '分钟');
    });

    // 设置模态框中的截止时间输入 - 自动保存
    document.getElementById('modalDeadline').addEventListener('input', (e) => {
        deadline = parseInt(e.target.value);
        console.log('截止时间设置已自动保存:', deadline + '分钟');
    });

    // 交换按钮
    document.getElementById('swapTokensBtn').addEventListener('click', swapTokens);
    document.getElementById('swapActionBtn').addEventListener('click', executeSwap);

    // 流动性切换按钮（如果存在）
    const addLiquidityToggle = document.getElementById('addLiquidityToggle');
    const removeLiquidityToggle = document.getElementById('removeLiquidityToggle');
    
    if (addLiquidityToggle) {
        addLiquidityToggle.addEventListener('click', () => switchLiquidityMode('add'));
    }
    if (removeLiquidityToggle) {
        removeLiquidityToggle.addEventListener('click', () => switchLiquidityMode('remove'));
    }

    // 添加流动性按钮
    const addLiquidityBtn = document.getElementById('addLiquidityBtn');
    if (addLiquidityBtn) {
        addLiquidityBtn.addEventListener('click', executeAddLiquidity);
    }
    
    // 撤出流动性按钮
    const removeLiquidityBtn = document.getElementById('removeLiquidityBtn');
    if (removeLiquidityBtn) {
        removeLiquidityBtn.addEventListener('click', executeRemoveLiquidity);
    }

    // 搜索流动性池按钮
    const searchLiquidityBtn = document.getElementById('searchLiquidityBtn');
    if (searchLiquidityBtn) {
        searchLiquidityBtn.addEventListener('click', searchLiquidityPool);
    }
    
    // 添加手动检查按钮（用于调试）
    if (addLiquidityBtn) {
    addLiquidityBtn.addEventListener('dblclick', () => {
        console.log('手动触发流动性表单检查');
        checkLiquidityForm();
    });
    }

    // 最大按钮（如果存在）
    const fromMaxBtn = document.getElementById('fromMaxBtn');
    const liquidityAMaxBtn = document.getElementById('liquidityAMaxBtn');
    const liquidityBMaxBtn = document.getElementById('liquidityBMaxBtn');
    
    if (fromMaxBtn) {
        fromMaxBtn.addEventListener('click', () => setMaxAmount('from'));
    }
    if (liquidityAMaxBtn) {
        liquidityAMaxBtn.addEventListener('click', () => setMaxAmount('liquidityA'));
    }
    if (liquidityBMaxBtn) {
        liquidityBMaxBtn.addEventListener('click', () => setMaxAmount('liquidityB'));
    }

    // 金额输入
    const fromAmount = document.getElementById('fromAmount');
    const liquidityAAmount = document.getElementById('liquidityAAmount');
    const liquidityBAmount = document.getElementById('liquidityBAmount');
    
    if (fromAmount) {
        fromAmount.addEventListener('input', handleAmountInput);
    }
    if (liquidityAAmount) {
        liquidityAAmount.addEventListener('input', handleLiquidityAmountInput);
    }
    if (liquidityBAmount) {
        liquidityBAmount.addEventListener('input', handleLiquidityAmountInput);
    }
    
    // 百分比选择器 - 绑定撤出流动性页面的按钮
    document.querySelectorAll('#lpTokenAmount').forEach(lpInput => {
        const percentageSelector = lpInput.parentElement.querySelector('.percentage-selector');
        if (percentageSelector) {
            percentageSelector.querySelectorAll('.percentage-btn').forEach(btn => {
        btn.addEventListener('click', handlePercentageSelect);
            });
        }
    });

    // 为Swap界面的百分比按钮添加特殊处理
    const swapPercentageBtns = document.querySelectorAll('.percentage-selector .percentage-btn');
    swapPercentageBtns.forEach(btn => {
        btn.addEventListener('click', handleSwapPercentageSelect);
    });

    // 代币搜索
    const tokenSearchInput = document.getElementById('tokenSearch');
    if (tokenSearchInput) {
        // 统一的输入处理函数
        const handleInput = (e) => {
            console.log('输入事件触发:', e.target.value);
            const value = e.target.value;
            const cleanedValue = value.replace(/\s+/g, ''); // 去除所有空格
            if (value !== cleanedValue) {
                e.target.value = cleanedValue;
            }
            // 触发搜索
            handleTokenSearch();
        };
        
        // 输入时自动搜索，减少延迟
        tokenSearchInput.addEventListener('input', debounce(handleInput, 100));
        
        // 添加回车键搜索
        tokenSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleTokenSearch();
            }
        });
        
        // 添加粘贴事件
        tokenSearchInput.addEventListener('paste', (e) => {
            setTimeout(() => {
                handleTokenSearch();
            }, 50);
        });
        
        console.log('代币搜索事件监听器已绑定');
        
    } else {
        console.error('未找到tokenSearch元素');
    }

    // 点击模态框外部关闭
    const tokenModal = document.getElementById('tokenModal');
    const settingsModal = document.getElementById('settingsModal');
    
    if (tokenModal) {
        tokenModal.addEventListener('click', (e) => {
        if (e.target.id === 'tokenModal' || e.target.classList.contains('modal-content')) {
            closeTokenModal();
        }
    });
    }
    
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
        if (e.target.id === 'settingsModal') closeSettingsModal();
    });
    }
}

// 初始化Web3
async function initializeWeb3() {
    if (typeof window.ethereum !== 'undefined') {
        web3 = new Web3(window.ethereum);
        try {
            // 检查网络
            const chainId = await web3.eth.getChainId();
            console.log('当前网络ID:', chainId);
            
            // 检查是否在Gate Layer网络
            if (chainId !== 10088) { // 10088是Gate Layer
                console.log('当前网络ID:', chainId, '期望网络ID: 10088');
                // 显示提示用户切换到Gate Layer网络
                showNotification({
                    zh: '请切换到Gate Layer网络以获得最佳体验',
                    en: 'Please switch to Gate Layer network for the best experience'
                }, 'info');
            } else {
                console.log('已连接到Gate Layer网络 (10088)');
                // 更新网络状态显示
                const networkName = document.getElementById('networkName');
                if (networkName) {
                    networkName.textContent = t('gateLayer');
                    networkName.style.color = '#10b981';
                }
            }
            
            // 更新网络状态显示
            checkNetworkStatus();
            
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            const accounts = await web3.eth.getAccounts();
            userAccount = accounts[0];
            updateWalletStatus();
            
            // 监听账户变化
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    userAccount = null;
                    updateWalletStatus();
                    showNotification({
                        zh: '钱包已断开连接',
                        en: 'Wallet disconnected'
                    }, 'info');
                } else {
                    userAccount = accounts[0];
                    updateWalletStatus();
                    showNotification({
                        zh: '钱包账户已切换',
                        en: 'Wallet account switched'
                    }, 'info');
                }
            });
            
            // 监听网络变化
            window.ethereum.on('chainChanged', (chainId) => {
                window.location.reload();
            });
            
        } catch (error) {
            console.error('用户拒绝连接钱包:', error);
        }
    } else {
        console.error('请安装MetaMask或其他Web3钱包');
        showNotification({
            zh: '请安装MetaMask或其他Web3钱包',
            en: 'Please install MetaMask or other Web3 wallet'
        }, 'info');
    }
}

// 检测可用的钱包提供者
function detectWalletProviders() {
    const providers = [];
    
    // 调试信息：显示所有可用的window对象
    console.log('检测钱包提供者...');
    console.log('window.ethereum:', window.ethereum);
    console.log('window.gatewallet:', window.gatewallet);
    console.log('window.gate:', window.gate);
    console.log('window.okxwallet:', window.okxwallet);
    console.log('window.tokenpocket:', window.tokenpocket);
    
    // MetaMask
    if (window.ethereum && window.ethereum.isMetaMask) {
        providers.push({
            name: 'MetaMask',
            provider: window.ethereum,
            icon: 'metamask.jpg'
        });
    }
    
    // OKX Wallet
    if (window.okxwallet) {
        providers.push({
            name: 'OKX Wallet',
            provider: window.okxwallet,
            icon: 'okx.jpg'
        });
    }
    
    // GateWallet - 检测多种可能的window对象
    if (window.gatewallet) {
        providers.push({
            name: 'GateWallet',
            provider: window.gatewallet,
            icon: 'gatewallet.png'
        });
    } else if (window.gate) {
        providers.push({
            name: 'GateWallet',
            provider: window.gate,
            icon: 'gatewallet.png'
        });
    } else if (window.ethereum && window.ethereum.isGateWallet) {
        providers.push({
            name: 'GateWallet',
            provider: window.ethereum,
            icon: 'gatewallet.png'
        });
    }
    
    // TokenPocket
    if (window.tokenpocket) {
        providers.push({
            name: 'TokenPocket',
            provider: window.tokenpocket,
            icon: 'tp.jpg'
        });
    }
    
    // Trust Wallet
    if (window.ethereum && window.ethereum.isTrust) {
        providers.push({
            name: 'Trust Wallet',
            provider: window.ethereum,
            icon: 'trust.png'
        });
    }
    
    // Coinbase Wallet
    if (window.ethereum && window.ethereum.isCoinbaseWallet) {
        providers.push({
            name: 'Coinbase Wallet',
            provider: window.ethereum,
            icon: 'coinbase.png'
        });
    }
    
    // 其他兼容EIP-1193的钱包
    if (window.ethereum && !providers.some(p => p.provider === window.ethereum)) {
        // 尝试检测钱包类型
        let walletName = 'Ethereum Wallet';
        let walletIcon = 'ethereum.png';
        
        // 检查是否是GateWallet（通过用户代理或其他特征）
        if (window.ethereum.isGateWallet || 
            (window.ethereum.providers && window.ethereum.providers.some(p => p.isGateWallet))) {
            walletName = 'GateWallet';
            walletIcon = 'gatewallet.png';
        }
        
        providers.push({
            name: walletName,
            provider: window.ethereum,
            icon: walletIcon
        });
    }
    
    return providers;
}

// 显示钱包选择对话框
async function showWalletSelectionDialog(providers) {
    return new Promise((resolve) => {
        // 创建钱包选择模态框
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.zIndex = '10000';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3 data-text-zh="选择钱包" data-text-en="Select Wallet">选择钱包</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove(); resolve(null);">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="wallet-list">
                        ${providers.map(provider => `
                            <div class="wallet-item" onclick="selectWallet('${provider.name}')">
                                <img src="${provider.icon}" alt="${provider.name}" class="wallet-icon" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiMzMzMiLz4KPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTggMkM0LjY4NjI5IDIgMiA0LjY4NjI5IDIgOFM0LjY4NjI5IDE0IDggMTRTMTQgMTEuMzEzNyAxNCA4UzExLjMxMzcgMiA4IDJaTTggMTJDNS43OTE0NCAxMiA0IDEwLjIwODUgNCA4UzUuNzkxNDQgNCA4IDRTMTIgNS43OTE0NCAxMiA4UzEwLjIwODUgMTIgOCAxMloiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo8L3N2Zz4K'">
                                <div class="wallet-details">
                                    <span class="wallet-name">${provider.name}</span>
                                    <span class="wallet-status">点击连接</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .wallet-list {
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
            }
            .wallet-item {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1rem;
                background: #212121;
                border-radius: 12px;
                border: 2px solid #212121;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            .wallet-item:hover {
                transform: scale(1.02);
                border-color: #4a9eff;
                box-shadow: 0 4px 12px rgba(74, 158, 255, 0.3);
            }
            .wallet-icon {
                width: 32px;
                height: 32px;
                border-radius: 50%;
            }
            .wallet-details {
                display: flex;
                flex-direction: column;
                gap: 0.25rem;
            }
            .wallet-name {
                font-weight: 600;
                color: #fff;
                font-size: 1rem;
            }
            .wallet-status {
                color: #999;
                font-size: 0.875rem;
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(modal);
        
        // 全局函数用于选择钱包
        window.selectWallet = (walletName) => {
            const provider = providers.find(p => p.name === walletName);
            modal.remove();
            document.head.removeChild(style);
            delete window.selectWallet;
            resolve(provider);
        };
        
        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                document.head.removeChild(style);
                delete window.selectWallet;
                resolve(null);
            }
        });
    });
}

// 连接钱包
async function connectWallet() {
    // 检测可用的钱包提供者
    const walletProviders = detectWalletProviders();
    
    if (walletProviders.length === 0) {
        // 提供更详细的错误信息和解决方案
        console.log('未检测到任何钱包提供者');
        console.log('请检查：');
        console.log('1. 是否已安装GateWallet扩展');
        console.log('2. 扩展是否已启用');
        console.log('3. 页面是否已刷新');
        
        showNotification({
            zh: '未检测到钱包，请确保已安装并启用GateWallet扩展，然后刷新页面',
            en: 'No wallet detected, please ensure GateWallet extension is installed and enabled, then refresh the page'
        }, 'error');
        return;
    }
    
    // 如果有多个钱包，让用户选择
    let selectedProvider;
    if (walletProviders.length === 1) {
        selectedProvider = walletProviders[0];
    } else {
        // 显示钱包选择对话框
        selectedProvider = await showWalletSelectionDialog(walletProviders);
        if (!selectedProvider) {
            return; // 用户取消选择
        }
    }
    
    try {
        // 使用选中的钱包提供者初始化web3
        if (!web3 || web3.currentProvider !== selectedProvider.provider) {
            web3 = new Web3(selectedProvider.provider);
        }
        
        // 请求账户访问
        await selectedProvider.provider.request({ method: 'eth_requestAccounts' });
        const accounts = await web3.eth.getAccounts();
        userAccount = accounts[0];
        currentWallet = selectedProvider; // 保存当前钱包信息
        updateWalletStatus();
        showNotification({
            zh: `${selectedProvider.name}连接成功`,
            en: `${selectedProvider.name} connected successfully`
        }, 'success');
        
        // 连接钱包后更新余额
        const defaultFromToken = {
            address: '0x0000000000000000000000000000000000000000',
            symbol: 'GT',
            name: 'Gate Token',
            decimals: 18,
            icon: 'gt-logo.png'
        };
        const defaultToToken = {
            address: '0x1234567890123456789012345678901234567890', // WGT合约地址
            symbol: 'WGT',
            name: 'Wrapped Gate Token',
            decimals: 18,
            icon: 'gt-logo.png'
        };
        
        // 余额默认显示0，查到了再更新
        const balanceText = currentLanguage === 'zh' ? '余额: 0' : 'Balance: 0';
        document.getElementById('fromBalance').textContent = balanceText;
        document.getElementById('liquidityABalance').textContent = balanceText;
        document.getElementById('liquidityBBalance').textContent = balanceText;
        
        // 异步更新余额
        updateBalance('fromBalance', defaultFromToken);
        updateBalance('liquidityABalance', defaultFromToken);
        updateBalance('liquidityBBalance', defaultToToken);
        
        // 初始化代币选择器显示
        updateTokenDisplay('fromTokenSelect', defaultFromToken);
        // 不设置toTokenSelect的默认值，让用户自己选择
        // 设置liquidityATokenSelect默认为GT，liquidityBTokenSelect让用户自己选择
        updateTokenDisplay('liquidityATokenSelect', defaultFromToken);
        
        // 检查流动性表单
        checkLiquidityForm();
        // 强制刷新按钮状态
        forceRefreshLiquidityButton();
        
    } catch (error) {
        console.error('连接钱包失败:', error);
        showNotification({
            zh: '连接钱包失败',
            en: 'Failed to connect wallet'
        }, 'error');
    }
}

// 更新钱包状态
function updateWalletStatus() {
    const connectBtn = document.getElementById('connectWallet');
    const swapBtn = document.getElementById('swapActionBtn');
    const currentLang = document.getElementById('languageText').textContent;
    const connectText = currentLang === '中文' ? '连接钱包' : 'Connect Wallet';
    const swapText = currentLang === '中文' ? '交换' : 'Swap';
    
    if (userAccount) {
        // 已连接钱包时显示地址和钱包名称
        const walletName = currentWallet ? currentWallet.name : 'Wallet';
        const shortAddress = `${userAccount.slice(0, 6)}...${userAccount.slice(-4)}`;
        connectBtn.innerHTML = `<i class="fas fa-wallet"></i> <span class="btn-text">${walletName}: ${shortAddress}</span>`;
        connectBtn.style.background = 'rgba(16, 185, 129, 0.2)';
        connectBtn.style.borderColor = '#10b981';
        connectBtn.querySelector('i').style.color = '#10b981';
        
        // 添加断开连接功能
        connectBtn.onclick = disconnectWallet;
        
        // 更新交换按钮文本
        if (swapBtn) {
            swapBtn.innerHTML = `<i class="fas fa-exchange-alt"></i> ${swapText}`;
        }
    } else {
        // 未连接钱包时显示连接文本
        connectBtn.innerHTML = `<i class="fas fa-wallet"></i> <span class="btn-text">${connectText}</span>`;
        connectBtn.style.background = 'rgba(33, 33, 33, 0.6)';
        connectBtn.style.borderColor = '#212121';
        connectBtn.querySelector('i').style.color = '#22c55e';
        
        // 未连接钱包时，交换按钮显示为连接钱包
        if (swapBtn) {
            swapBtn.innerHTML = `<i class="fas fa-wallet"></i> ${connectText}`;
        }
    }
}

// 断开钱包连接
function disconnectWallet() {
    userAccount = null;
    currentWallet = null;
    web3 = null;
    updateWalletStatus();
    
    // 重置连接按钮
    const connectBtn = document.getElementById('connectWallet');
    connectBtn.onclick = connectWallet;
    
    showNotification({
        zh: '钱包已断开连接',
        en: 'Wallet disconnected'
    }, 'info');
}

// 切换网络 - 自动切换到Gate Layer
async function switchNetwork() {
    if (!window.ethereum) {
        showNotification({
            zh: '请安装MetaMask',
            en: 'Please install MetaMask'
        }, 'info');
        return;
    }
    
    try {
        // 确保web3已初始化
        if (!web3) {
            web3 = new Web3(window.ethereum);
        }
        
        // 检查当前网络
        const currentChainId = await web3.eth.getChainId();
        console.log('当前网络ID:', currentChainId);
        
        // 如果已经在Gate Layer网络，提示用户
        if (currentChainId === 10088) {
            showNotification({
                zh: '已连接到Gate Layer网络',
                en: 'Already connected to Gate Layer network'
            }, 'info');
            return;
        }
        
        console.log('尝试切换到Gate Layer网络，链ID:', NETWORK_CONFIG.chainId);
        
        // 尝试切换到Gate Layer网络
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: NETWORK_CONFIG.chainId }], // Gate Layer chainId
        });
        
        // 验证切换是否成功
        const newChainId = await web3.eth.getChainId();
        console.log('切换后网络ID:', newChainId);
        
        // 更新网络状态显示
        const networkName = document.getElementById('networkName');
        networkName.textContent = t('gateLayer');
        networkName.style.color = '#10b981';
        
            showNotification({
                zh: '已成功切换到Gate Layer网络',
                en: 'Successfully switched to Gate Layer network'
            }, 'success');
        
    } catch (switchError) {
        console.error('切换网络失败:', switchError);
        
        // 如果网络不存在，尝试添加
        if (switchError.code === 4902) {
            try {
                console.log('网络不存在，尝试添加网络:', NETWORK_CONFIG);
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [NETWORK_CONFIG],
                });
                
                // 添加成功后，再次尝试切换
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: NETWORK_CONFIG.chainId }],
                });
                
                // 更新网络状态显示
                const networkName = document.getElementById('networkName');
                networkName.textContent = t('gateLayer');
                networkName.style.color = '#10b981';
                
                showNotification({
                    zh: '已添加并切换到Gate Layer网络',
                    en: 'Added and switched to Gate Layer network'
                }, 'success');
            } catch (addError) {
                console.error('添加网络失败:', addError);
                showNotification({
                    zh: '添加网络失败: ' + addError.message,
                    en: 'Failed to add network: ' + addError.message
                }, 'info');
            }
        } else {
            showNotification({
                zh: '切换网络失败: ' + switchError.message,
                en: 'Failed to switch network: ' + switchError.message
            }, 'info');
        }
    }
}

// 检查网络状态
async function checkNetworkStatus() {
    if (!window.ethereum) {
        console.log('MetaMask未安装');
        return;
    }
    
    try {
        // 确保web3已初始化
        if (!web3) {
            web3 = new Web3(window.ethereum);
        }
        
        const chainId = await web3.eth.getChainId();
        const networkName = document.getElementById('networkName');
        
        console.log('当前网络ID:', chainId);
        
        if (chainId === 10088) {
            networkName.textContent = t('gateLayer');
            networkName.style.color = '#10b981';
        } else {
            networkName.textContent = `${t('network')} ${chainId}`;
            networkName.style.color = '#60a5fa';
        }
    } catch (error) {
        console.error('检查网络状态失败:', error);
    }
}

// 切换标签页
function switchTab(tab) {
    console.log('切换到标签页:', tab); // 调试日志
    
    // 更新导航按钮状态
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    // 更新内容区域
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const targetTab = document.getElementById(`${tab}-tab`);
    console.log('目标标签页元素:', targetTab); // 调试日志
    
    if (targetTab) {
        targetTab.classList.add('active');
        console.log('成功激活标签页:', tab); // 调试日志
        
        // 如果切换到流动性页面，刷新按钮状态
        if (tab === 'liquidity') {
            setTimeout(() => {
                checkLiquidityForm();
                forceRefreshLiquidityButton();
            }, 100);
        }
    } else {
        console.error('找不到标签页元素:', `${tab}-tab`); // 调试日志
    }

    currentTab = tab;
}

// 切换移动端菜单
function toggleMobileMenu() {
    const navMenu = document.getElementById('navMenu');
    const navActions = document.getElementById('navActions');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    
    console.log('切换移动端菜单'); // 调试日志
    console.log('navMenu元素:', navMenu); // 调试日志
    console.log('navActions元素:', navActions); // 调试日志
    
    const isOpen = navMenu.classList.contains('active');
    console.log('菜单是否打开:', isOpen); // 调试日志
    
    if (isOpen) {
        closeMobileMenu();
    } else {
        openMobileMenu();
    }
}

// 打开移动端菜单
function openMobileMenu() {
    const navMenu = document.getElementById('navMenu');
    const navActions = document.getElementById('navActions');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    
    console.log('打开移动端菜单'); // 调试日志
    
    navMenu.classList.add('active');
    navActions.classList.add('active');
    mobileMenuBtn.innerHTML = '<i class="fas fa-times"></i>';
    
    console.log('菜单类名:', navMenu.className); // 调试日志
    console.log('操作按钮类名:', navActions.className); // 调试日志
}

// 关闭移动端菜单
function closeMobileMenu() {
    const navMenu = document.getElementById('navMenu');
    const navActions = document.getElementById('navActions');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    
    navMenu.classList.remove('active');
    navActions.classList.remove('active');
    mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
}

// 切换语言
function toggleLanguage() {
    const currentLang = document.getElementById('languageText').textContent;
    const newLang = currentLang === '中文' ? 'English' : '中文';
    
    // 更新语言按钮显示
    document.getElementById('languageText').textContent = newLang;
    
    // 更新全局语言变量
    currentLanguage = newLang === '中文' ? 'zh' : 'en';
    
    // 更新导航栏文本
    updateNavigationText(newLang);
    
    // 在移动端点击后关闭菜单
    closeMobileMenu();
}

// 更新导航栏文本
function updateNavigationText(lang) {
    const navTexts = document.querySelectorAll('.nav-text');
    const connectWalletText = document.querySelector('.btn-text');
    
    if (lang === 'zh') {
        // 切换到中文
        navTexts[0].textContent = '交换';
        navTexts[1].textContent = '流动性';
        connectWalletText.textContent = '连接钱包';
        
        // 更新全局语言
        updateGlobalLanguage('zh');
        
        // 更新搜索框placeholder
        const tokenSearchInput = document.getElementById('tokenSearch');
        if (tokenSearchInput) {
            tokenSearchInput.placeholder = tokenSearchInput.dataset.placeholderZh;
        }
        
        // 更新网络名称
        const networkName = document.getElementById('networkName');
        if (networkName) {
            const currentChainId = networkName.textContent.includes('网络') || networkName.textContent.includes('Network') ? 
                networkName.textContent.split(' ')[1] : null;
            if (currentChainId) {
                networkName.textContent = `网络 ${currentChainId}`;
            } else {
                networkName.textContent = t('gateLayer');
            }
        }
        
        // 更新设置相关文本
        const settingsLabel = document.querySelector('.switch');
        if (settingsLabel) {
            settingsLabel.innerHTML = '滑点设置？ <label class="signup_tog" for="swap_toggle">设置</label>';
        }
        
        const slippageFormDetails = document.querySelector('.form_back .form_details');
        if (slippageFormDetails && slippageFormDetails.textContent === 'Slippage Settings') {
            slippageFormDetails.textContent = '滑点设置';
        }
        
        // 更新form_back中的滑点设置标签
        const formBackLabels = document.querySelectorAll('.form_back .setting-item label');
        formBackLabels.forEach(label => {
            if (label.dataset.textZh && label.dataset.textEn) {
                label.textContent = label.dataset.textZh;
            }
        });
        
        const formBackSpans = document.querySelectorAll('.form_back .setting-item span');
        formBackSpans.forEach(span => {
            if (span.dataset.textZh && span.dataset.textEn) {
                span.textContent = span.dataset.textZh;
            }
        });
        
        const deadlineLabel = document.querySelector('.setting-item:nth-child(2) label');
        if (deadlineLabel && deadlineLabel.textContent === 'Transaction Deadline') {
            deadlineLabel.textContent = '交易截止时间';
        }
        
        const deadlineSpan = document.querySelector('.setting-item:nth-child(2) span');
        if (deadlineSpan && deadlineSpan.textContent === 'minutes') {
            deadlineSpan.textContent = '分钟';
        }
        
        // 保存设置按钮已移除，无需更新
        
        const backToSwap = document.querySelector('.switch:last-child');
        if (backToSwap && backToSwap.textContent.includes('Back to Swap?')) {
            backToSwap.innerHTML = '返回交换？ <label class="signup_tog" for="swap_toggle">交换</label>';
        }
    } else {
        // 切换到英文
        navTexts[0].textContent = 'Swap';
        navTexts[1].textContent = 'Liquidity';
        connectWalletText.textContent = 'Connect Wallet';
        
        // 更新全局语言
        updateGlobalLanguage('en');
        
        // 更新搜索框placeholder
        const tokenSearchInput = document.getElementById('tokenSearch');
        if (tokenSearchInput) {
            tokenSearchInput.placeholder = tokenSearchInput.dataset.placeholderEn;
        }
        
        // 更新网络名称
        const networkName = document.getElementById('networkName');
        if (networkName) {
            const currentChainId = networkName.textContent.includes('网络') || networkName.textContent.includes('Network') ? 
                networkName.textContent.split(' ')[1] : null;
            if (currentChainId) {
                networkName.textContent = `Network ${currentChainId}`;
            } else {
                networkName.textContent = t('gateLayer');
            }
        }
        
        // 更新设置相关文本
        const settingsLabel = document.querySelector('.switch');
        if (settingsLabel) {
            settingsLabel.innerHTML = 'Slippage Settings? <label class="signup_tog" for="swap_toggle">Settings</label>';
        }
        
        const slippageFormDetails = document.querySelector('.form_back .form_details');
        if (slippageFormDetails && slippageFormDetails.textContent === '滑点设置') {
            slippageFormDetails.textContent = 'Slippage Settings';
        }
        
        // 更新form_back中的滑点设置标签
        const formBackLabels = document.querySelectorAll('.form_back .setting-item label');
        formBackLabels.forEach(label => {
            if (label.dataset.textZh && label.dataset.textEn) {
                label.textContent = label.dataset.textEn;
            }
        });
        
        const formBackSpans = document.querySelectorAll('.form_back .setting-item span');
        formBackSpans.forEach(span => {
            if (span.dataset.textZh && span.dataset.textEn) {
                span.textContent = span.dataset.textEn;
            }
        });
        
        // 保存设置按钮已移除，无需更新
        
        const backToSwap = document.querySelector('.switch:last-child');
        if (backToSwap && backToSwap.textContent.includes('返回交换？')) {
            backToSwap.innerHTML = 'Back to Swap? <label class="signup_tog" for="swap_toggle">Swap</label>';
        }
    }
    
    // 更新钱包状态以刷新按钮文本
    updateWalletStatus();
}

// 全局语言切换函数
function updateGlobalLanguage(lang) {
    // 更新全局语言变量
    currentLanguage = lang;
    
    // 更新Swap界面
    updateSwapInterfaceText(lang);
    
    // 更新流动性界面
    updateLiquidityInterfaceText(lang);
    
    // 更新模态框文本
    updateModalText(lang);
    
    // 更新警告和提示文本
    updateAlertText(lang);
    
    // 更新其他界面元素
    updateOtherElements(lang);
}

// 更新Swap界面文本
function updateSwapInterfaceText(lang) {
    // 更新表单标题
    const formDetails = document.querySelector('.form_details');
    if (formDetails) {
        formDetails.textContent = lang === 'zh' ? '交换代币' : 'Swap Tokens';
    }
    
    // 更新代币输入标签
    const tokenInputHeaders = document.querySelectorAll('.token-input-header span:first-child');
    
    if (lang === 'zh') {
        // 更新"从"和"到"标签
        tokenInputHeaders.forEach((label, index) => {
            if (index === 0) label.textContent = '从';
            if (index === 1) label.textContent = '到';
        });
        
        // 更新余额标签
        const balanceLabels = document.querySelectorAll('.balance');
        balanceLabels.forEach(label => {
            if (label.textContent.includes('Balance:')) {
                label.textContent = label.textContent.replace('Balance:', '余额:');
            }
        });
        
        // 更新选择代币文本（只更新真正的选择代币按钮，不影响已选择的代币）
        const selectTokenTexts = document.querySelectorAll('.select-token-text');
        console.log('中文语言切换：找到', selectTokenTexts.length, '个select-token-text元素');
        selectTokenTexts.forEach((text, index) => {
            // 检查父元素是否有has-token类，如果有说明已经选择了代币，不应该更新
            const parentTokenInfo = text.closest('.token-info');
            const hasTokenClass = parentTokenInfo && parentTokenInfo.classList.contains('has-token');
            console.log(`中文语言切换：处理第${index}个元素`, {
                hasTokenClass: hasTokenClass,
                currentText: text.textContent,
                parentElement: parentTokenInfo
            });
            
            if (hasTokenClass) {
                console.log(`中文语言切换：跳过已选择代币的元素 ${index}`);
                return; // 跳过已选择代币的元素
            }
            
            if (text.dataset.textZh) {
                text.textContent = text.dataset.textZh;
            } else if (text.textContent === 'Select Token') {
                text.textContent = '选择代币';
            }
        });
        
        // 更新最大按钮文本
        const maxBtns = document.querySelectorAll('.max-btn');
        maxBtns.forEach(btn => {
            if (btn.textContent === 'Max') {
                btn.textContent = '最大';
            }
        });
        
        // 更新百分比按钮文本
        const percentageBtns = document.querySelectorAll('.percentage-btn');
        percentageBtns.forEach(btn => {
            if (btn.textContent === 'Max') {
                btn.textContent = '最大';
            }
        });
        
        // 更新价格信息标签
        const priceLabels = document.querySelectorAll('.price-row span:first-child');
        priceLabels.forEach(label => {
            if (label.textContent === 'Price') {
                label.textContent = '价格';
            } else if (label.textContent === 'Slippage') {
                label.textContent = '滑点';
            }
        });
        
    } else {
        // 更新"从"和"到"标签
        tokenInputHeaders.forEach((label, index) => {
            if (index === 0) label.textContent = 'From';
            if (index === 1) label.textContent = 'To';
        });
        
        // 更新余额标签
        const balanceLabels = document.querySelectorAll('.balance');
        balanceLabels.forEach(label => {
            if (label.textContent.includes('余额:')) {
                label.textContent = label.textContent.replace('余额:', 'Balance:');
            }
        });
        
        // 更新选择代币文本（只更新真正的选择代币按钮，不影响已选择的代币）
        const selectTokenTexts = document.querySelectorAll('.select-token-text');
        console.log('英文语言切换：找到', selectTokenTexts.length, '个select-token-text元素');
        selectTokenTexts.forEach((text, index) => {
            // 检查父元素是否有has-token类，如果有说明已经选择了代币，不应该更新
            const parentTokenInfo = text.closest('.token-info');
            const hasTokenClass = parentTokenInfo && parentTokenInfo.classList.contains('has-token');
            console.log(`英文语言切换：处理第${index}个元素`, {
                hasTokenClass: hasTokenClass,
                currentText: text.textContent,
                parentElement: parentTokenInfo
            });
            
            if (hasTokenClass) {
                console.log(`英文语言切换：跳过已选择代币的元素 ${index}`);
                return; // 跳过已选择代币的元素
            }
            
            if (text.dataset.textEn) {
                text.textContent = text.dataset.textEn;
            } else if (text.textContent === '选择代币') {
                text.textContent = 'Select Token';
            }
        });
        
        // 更新最大按钮文本
        const maxBtns = document.querySelectorAll('.max-btn');
        maxBtns.forEach(btn => {
            if (btn.textContent === '最大') {
                btn.textContent = 'Max';
            }
        });
        
        // 更新百分比按钮文本
        const percentageBtns = document.querySelectorAll('.percentage-btn');
        percentageBtns.forEach(btn => {
            if (btn.textContent === '最大') {
                btn.textContent = 'Max';
            }
        });
        
        // 更新价格信息标签
        const priceLabels = document.querySelectorAll('.price-row span:first-child');
        priceLabels.forEach(label => {
            if (label.textContent === '价格') {
                label.textContent = 'Price';
            } else if (label.textContent === '滑点') {
                label.textContent = 'Slippage';
            }
        });
    }
}

// 更新流动性界面文本
function updateLiquidityInterfaceText(lang) {
    // 更新流动性表单标题
    const liquidityFormDetails = document.querySelectorAll('.form_details');
    liquidityFormDetails.forEach(detail => {
        if (detail.textContent === '添加流动性' || detail.textContent === 'Add Liquidity') {
            detail.textContent = lang === 'zh' ? '添加流动性' : 'Add Liquidity';
        } else if (detail.textContent === '撤出流动性' || detail.textContent === 'Remove Liquidity') {
            detail.textContent = lang === 'zh' ? '撤出流动性' : 'Remove Liquidity';
        }
    });
    
    // 更新代币标签
    const tokenLabels = document.querySelectorAll('.token-input-header span:first-child');
    tokenLabels.forEach((label, index) => {
        if (lang === 'zh') {
            if (label.textContent === 'Token A' || label.textContent === 'Token B') {
                label.textContent = label.textContent === 'Token A' ? '代币A' : '代币B';
            }
        } else {
            if (label.textContent === '代币A' || label.textContent === '代币B') {
                label.textContent = label.textContent === '代币A' ? 'Token A' : 'Token B';
            }
        }
    });
    
    // 更新流动性按钮文本（只更新真正的操作按钮，不影响状态按钮）
    const liquidityBtns = document.querySelectorAll('.liquidity-action-btn');
    console.log('语言切换 - 找到流动性按钮数量:', liquidityBtns.length);
    liquidityBtns.forEach((btn, index) => {
        // 检查按钮是否处于正常状态（不是错误或禁用状态）
        const isNormalState = !btn.classList.contains('error-state') && !btn.classList.contains('disabled-state') && !btn.disabled;
        
        console.log(`语言切换 - 按钮${index}状态:`, {
            textContent: btn.textContent,
            isNormalState: isNormalState,
            hasErrorState: btn.classList.contains('error-state'),
            hasDisabledState: btn.classList.contains('disabled-state'),
            disabled: btn.disabled
        });
        
        if (isNormalState) {
        if (btn.textContent.includes('添加流动性') || btn.textContent.includes('Add Liquidity')) {
                btn.innerHTML = lang === 'zh' ? 
                '<i class="fas fa-plus-circle"></i> 添加流动性' : 
                '<i class="fas fa-plus-circle"></i> Add Liquidity';
        } else if (btn.textContent.includes('撤出流动性') || btn.textContent.includes('Remove Liquidity')) {
                btn.innerHTML = lang === 'zh' ? 
                '<i class="fas fa-minus-circle"></i> 撤出流动性' : 
                '<i class="fas fa-minus-circle"></i> Remove Liquidity';
            } else if (btn.textContent.includes('创建新池子') || btn.textContent.includes('Create New Pool')) {
                btn.innerHTML = lang === 'zh' ? 
                    '<i class="fas fa-plus-circle"></i> 创建新池子' : 
                    '<i class="fas fa-plus-circle"></i> Create New Pool';
            }
        } else {
            // 对于错误或禁用状态的按钮，也要确保有图标
            console.log(`语言切换 - 检查按钮${index}是否需要添加图标`);
            if (!btn.innerHTML.includes('<i class=')) {
                console.log(`语言切换 - 为按钮${index}添加图标`);
                const buttonText = btn.textContent;
                
                if (buttonText.includes('Please fill') || buttonText.includes('请填写')) {
                    btn.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${buttonText}`;
                } else if (buttonText.includes('Amount A') || buttonText.includes('Amount B') || buttonText.includes('金额A') || buttonText.includes('金额B')) {
                    btn.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${buttonText}`;
                } else if (buttonText.includes('Insufficient') || buttonText.includes('余额不足')) {
                    btn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${buttonText}`;
                } else if (buttonText.includes('Cannot select') || buttonText.includes('不能选择')) {
                    btn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${buttonText}`;
                } else if (buttonText.includes('Please connect') || buttonText.includes('请先连接')) {
                    btn.innerHTML = `<i class="fas fa-wallet"></i> ${buttonText}`;
                } else if (buttonText.includes('Balance check failed') || buttonText.includes('检查余额失败')) {
                    btn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${buttonText}`;
                }
            } else {
                console.log(`语言切换 - 按钮${index}已有图标，保持当前状态`);
            }
        }
        // 对于错误或禁用状态的按钮，不进行语言切换更新，保持当前状态
    });
    
    // 更新搜索流动性池相关文本
    const searchLiquidityHeader = document.querySelector('.search-liquidity-header span');
    if (searchLiquidityHeader) {
        searchLiquidityHeader.textContent = lang === 'zh' ? '搜索流动性池' : 'Search Liquidity Pool';
    }
    
    const searchLiquidityBtn = document.getElementById('searchLiquidityBtn');
    if (searchLiquidityBtn) {
        searchLiquidityBtn.innerHTML = lang === 'zh' ? 
            '<i class="fas fa-search"></i> 搜索池' : 
            '<i class="fas fa-search"></i> Search Pool';
    }
    
    // 更新流动性信息标签
    const liquidityInfoLabels = document.querySelectorAll('.liquidity-info .info-row span:first-child');
    liquidityInfoLabels.forEach(label => {
        if (label.textContent === '价格' || label.textContent === 'Price') {
            label.textContent = lang === 'zh' ? '价格' : 'Price';
        } else if (label.textContent === '份额' || label.textContent === 'Share') {
            label.textContent = lang === 'zh' ? '份额' : 'Share';
        }
    });
    
    // 更新移除流动性信息标签
    const removeLiquidityLabels = document.querySelectorAll('.remove-liquidity-info .info-row span:first-child');
    removeLiquidityLabels.forEach(label => {
        if (label.textContent === 'You will receive' || label.textContent === '您将收到') {
            label.textContent = lang === 'zh' ? '您将收到' : 'You will receive';
        }
    });
    
    // 更新切换按钮文本
    const switchLabels = document.querySelectorAll('.switch');
    switchLabels.forEach(switchLabel => {
        if (switchLabel.textContent.includes('Need to remove liquidity?')) {
            switchLabel.innerHTML = lang === 'zh' ? 
                '需要撤出流动性？ <label class="signup_tog" for="liquidity_toggle">撤出</label>' : 
                'Need to remove liquidity? <label class="signup_tog" for="liquidity_toggle">Remove</label>';
        } else if (switchLabel.textContent.includes('Back to add liquidity?')) {
            switchLabel.innerHTML = lang === 'zh' ? 
                '返回添加流动性？ <label class="signup_tog" for="liquidity_toggle">添加</label>' : 
                'Back to add liquidity? <label class="signup_tog" for="liquidity_toggle">Add</label>';
        }
    });
    
    // 更新流动性池结果相关文本
    const poolDetailLabels = document.querySelectorAll('.pool-detail-row span:first-child');
    poolDetailLabels.forEach(label => {
        if (label.textContent === 'Total Liquidity' || label.textContent === '总流动性') {
            label.textContent = lang === 'zh' ? '总流动性' : 'Total Liquidity';
        } else if (label.textContent === 'Your LP Tokens' || label.textContent === '您的LP代币') {
            label.textContent = lang === 'zh' ? '您的LP代币' : 'Your LP Tokens';
        } else if (label.textContent === 'Your Share' || label.textContent === '您的份额') {
            label.textContent = lang === 'zh' ? '您的份额' : 'Your Share';
        }
    });
}

// 更新模态框文本
function updateModalText(lang) {
    // 更新代币选择模态框
    const tokenModalTitle = document.querySelector('#tokenModal .modal-header h3');
    if (tokenModalTitle) {
        if (tokenModalTitle.dataset.textZh && tokenModalTitle.dataset.textEn) {
            tokenModalTitle.textContent = lang === 'zh' ? tokenModalTitle.dataset.textZh : tokenModalTitle.dataset.textEn;
        } else {
            tokenModalTitle.textContent = lang === 'zh' ? '选择代币' : 'Select Token';
        }
    }
    
    const tokenSearchPlaceholder = document.querySelector('#tokenSearch');
    if (tokenSearchPlaceholder) {
        tokenSearchPlaceholder.placeholder = lang === 'zh' ? 
            '搜索代币名称或合约地址' : 
            'Search token name or contract address';
    }
    
    // 更新设置模态框标题
    const settingsModalTitle = document.querySelector('#settingsModal .modal-header h3');
    if (settingsModalTitle) {
        if (settingsModalTitle.dataset.textZh && settingsModalTitle.dataset.textEn) {
            settingsModalTitle.textContent = lang === 'zh' ? settingsModalTitle.dataset.textZh : settingsModalTitle.dataset.textEn;
        } else {
            settingsModalTitle.textContent = lang === 'zh' ? '交易设置' : 'Trading Settings';
        }
    }
    
    // 更新设置模态框中的标签
    const settingLabels = document.querySelectorAll('#settingsModal .setting-item label');
    settingLabels.forEach(label => {
        if (label.dataset.textZh && label.dataset.textEn) {
            label.textContent = lang === 'zh' ? label.dataset.textZh : label.dataset.textEn;
        }
    });
    
    // 更新设置模态框中的span文本
    const settingSpans = document.querySelectorAll('#settingsModal .setting-item span');
    settingSpans.forEach(span => {
        if (span.dataset.textZh && span.dataset.textEn) {
            span.textContent = lang === 'zh' ? span.dataset.textZh : span.dataset.textEn;
        }
    });
    
}

// 更新警告和提示文本
function updateAlertText(lang) {
    // 更新滑点警告
    const slippageWarning = document.getElementById('slippageWarning');
    if (slippageWarning) {
        const title = slippageWarning.querySelector('.alert-title');
        const message = slippageWarning.querySelector('.alert-message');
        if (title && message) {
            if (lang === 'zh') {
                title.textContent = '滑点警告';
                message.textContent = '当前滑点设置较高，可能导致交易价格偏差较大。建议调整滑点设置。';
            } else {
                title.textContent = 'Slippage Warning';
                message.textContent = 'Current slippage setting is high, which may cause significant price deviation. Consider adjusting slippage settings.';
            }
        }
    }
    
    // 更新价格影响提示
    const priceImpactInfo = document.getElementById('priceImpactInfo');
    if (priceImpactInfo) {
        const title = priceImpactInfo.querySelector('.alert-title');
        const message = priceImpactInfo.querySelector('.alert-message');
        if (title && message) {
            if (lang === 'zh') {
                title.textContent = '价格影响';
                message.textContent = '大额交易可能对市场价格产生影响，请注意交易时机。';
            } else {
                title.textContent = 'Price Impact';
                message.textContent = 'Large transactions may impact market prices. Please pay attention to trading timing.';
            }
        }
    }
}

// 搜索流动性池
async function searchLiquidityPool() {
    const tokenASelect = document.getElementById('searchTokenASelect');
    const tokenBSelect = document.getElementById('searchTokenBSelect');

    if (!tokenASelect.dataset.token || !tokenBSelect.dataset.token) {
        showNotification({
            zh: '请选择两个代币',
            en: 'Please select two tokens'
        }, 'error');
        return;
    }

    const tokenA = JSON.parse(tokenASelect.dataset.token);
    const tokenB = JSON.parse(tokenBSelect.dataset.token);

    console.log('搜索流动性池:', tokenA.symbol, tokenB.symbol);

    try {
        // 处理GT和WGT的特殊情况
        let queryTokenA = tokenA;
        let queryTokenB = tokenB;
        
        // 如果tokenA是GT（没有合约地址），使用WGT地址查询
        if (tokenA.address === '0x0000000000000000000000000000000000000000') {
            queryTokenA = {
                ...tokenA,
                address: CONTRACT_ADDRESSES.WGT
            };
            console.log(`GT没有合约地址，使用WGT地址查询: ${CONTRACT_ADDRESSES.WGT}`);
        }
        
        // 如果tokenB是GT（没有合约地址），使用WGT地址查询
        if (tokenB.address === '0x0000000000000000000000000000000000000000') {
            queryTokenB = {
                ...tokenB,
                address: CONTRACT_ADDRESSES.WGT
            };
            console.log(`GT没有合约地址，使用WGT地址查询: ${CONTRACT_ADDRESSES.WGT}`);
        }

        // 获取factory合约
        const factoryContract = new web3.eth.Contract(FACTORY_ABI, CONTRACT_ADDRESSES.factory);

        // 获取交易对地址
        const pairAddress = await factoryContract.methods.getPair(queryTokenA.address, queryTokenB.address).call();

        if (pairAddress === '0x0000000000000000000000000000000000000000') {
            showNotification({
                zh: '交易对不存在',
                en: 'Trading pair does not exist'
            }, 'error');
            document.getElementById('liquidityPoolResult').style.display = 'none';
            return;
        }

        console.log('找到交易对地址:', pairAddress);

        // 获取交易对信息
        const pairContract = new web3.eth.Contract(PAIR_ABI, pairAddress);

        // 获取储备量和总供应量
        const [reserves, totalSupply, token0, token1] = await Promise.all([
            pairContract.methods.getReserves().call(),
            pairContract.methods.totalSupply().call(),
            pairContract.methods.token0().call(),
            pairContract.methods.token1().call()
        ]);

        // 查询用户LP余额
        const userLPBalance = await getLPBalance(tokenA, tokenB);
        console.log('用户LP余额:', userLPBalance);

        // 确定哪个是tokenA，哪个是tokenB
        let reserveA, reserveB;
        if (token0.toLowerCase() === queryTokenA.address.toLowerCase()) {
            reserveA = reserves[0];
            reserveB = reserves[1];
        } else {
            reserveA = reserves[1];
            reserveB = reserves[0];
        }

        // 获取代币精度
        const tokenAContract = new web3.eth.Contract(ERC20_ABI, queryTokenA.address);
        const tokenBContract = new web3.eth.Contract(ERC20_ABI, queryTokenB.address);

        const [decimalsA, decimalsB] = await Promise.all([
            tokenAContract.methods.decimals().call(),
            tokenBContract.methods.decimals().call()
        ]);

        // 格式化储备量
        const formattedReserveA = web3.utils.fromWei(reserveA, decimalsA === 18 ? 'ether' : 'mwei');
        const formattedReserveB = web3.utils.fromWei(reserveB, decimalsB === 18 ? 'ether' : 'mwei');

        // 计算总流动性（简化计算）
        const totalLiquidity = (parseFloat(formattedReserveA) + parseFloat(formattedReserveB)).toFixed(2);

        // 计算用户份额
        const totalLP = parseFloat(web3.utils.fromWei(totalSupply, 'ether'));
        const userSharePercentage = userLPBalance > 0 ? (userLPBalance / totalLP) * 100 : 0;

        // 更新UI
        document.getElementById('totalLiquidity').textContent = `$${totalLiquidity}`;
        document.getElementById('userLPTokens').textContent = `${userLPBalance.toFixed(6)} LP`;
        document.getElementById('userShare').textContent = `${userSharePercentage.toFixed(4)}%`;

        // 存储池子信息供后续使用
        window.currentLiquidityPool = {
            pairAddress,
            tokenA: tokenA,
            tokenB: tokenB,
            queryTokenA: queryTokenA,
            queryTokenB: queryTokenB,
            reserves,
            totalSupply,
            token0,
            token1,
            decimalsA,
            decimalsB
        };

        // 显示结果
        document.getElementById('liquidityPoolResult').style.display = 'block';

        // 更新LP余额显示
        const lpTokenBalance = document.getElementById('lpTokenBalance');
        if (lpTokenBalance) {
            lpTokenBalance.textContent = currentLanguage === 'zh' ? `余额: ${userLPBalance.toFixed(6)}` : `Balance: ${userLPBalance.toFixed(6)}`;
        }

        showNotification({
            zh: '流动性池信息已更新',
            en: 'Liquidity pool information updated'
        }, 'success');

    } catch (error) {
        console.error('搜索流动性池失败:', error);
        showNotification({
            zh: '搜索失败，请检查代币地址',
            en: 'Search failed, please check token address'
        }, 'error');
    }
}

// 更新其他界面元素
function updateOtherElements(lang) {
    // 更新搜索流动性相关文本
    const searchLiquidityHeader = document.querySelector('.search-liquidity-header span');
    if (searchLiquidityHeader) {
        searchLiquidityHeader.textContent = lang === 'zh' ? '搜索流动性池' : 'Search Liquidity Pool';
    }

    const searchLiquidityBtn = document.getElementById('searchLiquidityBtn');
    if (searchLiquidityBtn) {
        searchLiquidityBtn.innerHTML = lang === 'zh' ?
            '<i class="fas fa-search"></i> 搜索流动性池' :
            '<i class="fas fa-search"></i> Search Liquidity Pool';
    }
    
    // 更新流动性池信息标签
    const poolDetailLabels = document.querySelectorAll('.pool-detail-row span:first-child');
    poolDetailLabels.forEach(label => {
        if (lang === 'zh') {
            if (label.textContent === 'Total Liquidity') label.textContent = '总流动性';
            if (label.textContent === 'Your LP Tokens') label.textContent = '您的LP代币';
            if (label.textContent === 'Your Share') label.textContent = '您的份额';
        } else {
            if (label.textContent === '总流动性') label.textContent = 'Total Liquidity';
            if (label.textContent === '您的LP代币') label.textContent = 'Your LP Tokens';
            if (label.textContent === '您的份额') label.textContent = 'Your Share';
        }
    });
}

// 切换流动性模式
function switchLiquidityMode(mode) {
    const addToggle = document.getElementById('addLiquidityToggle');
    const removeToggle = document.getElementById('removeLiquidityToggle');
    const addSection = document.querySelector('.liquidity-card > .token-input:not(.remove-liquidity-section)');
    const removeSection = document.getElementById('removeLiquiditySection');
    const addBtn = document.getElementById('addLiquidityBtn');
    const removeBtn = document.getElementById('removeLiquidityBtn');
    
    if (mode === 'add') {
        addToggle.classList.add('active');
        removeToggle.classList.remove('active');
        addSection.style.display = 'block';
        removeSection.style.display = 'none';
        addBtn.style.display = 'flex';
        removeBtn.style.display = 'none';
        document.querySelector('.liquidity-header h2').textContent = t('addLiquidity');
    } else {
        addToggle.classList.remove('active');
        removeToggle.classList.add('active');
        addSection.style.display = 'none';
        removeSection.style.display = 'block';
        addBtn.style.display = 'none';
        removeBtn.style.display = 'flex';
        document.querySelector('.liquidity-header h2').textContent = t('removeLiquidity');
    }
}

// 打开代币选择模态框
function openTokenModal(type) {
    console.log('打开代币选择模态框，类型:', type);
    selectedTokenType = type;
    const modal = document.getElementById('tokenModal');
    console.log('模态框元素:', modal);
    console.log('模态框样式:', modal.style.display, modal.classList.contains('active'));
    modal.classList.add('active');
    console.log('添加active类后:', modal.classList.contains('active'));
    document.getElementById('tokenSearch').focus();
    console.log('设置焦点完成');
}

// 关闭代币选择模态框
function closeTokenModal() {
    document.getElementById('tokenModal').classList.remove('active');
    selectedTokenType = null;
    document.getElementById('tokenSearch').value = '';
    updateTokenList();
}

// 打开设置模态框
function openSettingsModal(type) {
    document.getElementById('settingsModal').classList.add('active');
    // 重新初始化滑点按钮
    setTimeout(() => {
        initializeSlippageButtons();
        // 确保当前滑点值的按钮有active状态
        ensureCorrectSlippageButtonActive();
    }, 100);
}

// 确保当前滑点值的按钮有active状态（不干扰点击事件）
function ensureCorrectSlippageButtonActive() {
    console.log('确保当前滑点值的按钮有active状态，当前滑点:', slippage + '%');

    // 检查是否已经有按钮处于激活状态
    const activeButtons = document.querySelectorAll('.slippage-btn.active');
    if (activeButtons.length > 0) {
        console.log('已经有激活的按钮，跳过设置');
        return;
    }

    // 查找应该激活的按钮
    let targetButton = null;
    document.querySelectorAll('.slippage-btn').forEach(btn => {
        if (parseFloat(btn.dataset.slippage) === slippage) {
            targetButton = btn;
            return;
        }
    });

    // 如果找到了目标按钮，激活它
    if (targetButton) {
        targetButton.classList.add('active');
        console.log('激活按钮:', targetButton.textContent);
    } else {
        // 如果没有找到匹配的按钮，激活默认的25%按钮
        document.querySelectorAll('.slippage-btn').forEach(btn => {
            if (parseFloat(btn.dataset.slippage) === 25) {
                btn.classList.add('active');
                console.log('激活默认按钮:', btn.textContent);
                return;
            }
        });
    }
    
    // 更新价格信息区域的滑点显示
    const slippageDisplay = document.getElementById('slippage');
    if (slippageDisplay) {
        slippageDisplay.textContent = slippage + '%';
        console.log('初始化滑点显示:', slippage + '%');
    }
}

// 关闭设置模态框
function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('active');
}

// 更新代币列表
function updateTokenList() {
    const tokenList = document.getElementById('tokenList');
    const searchTerm = document.getElementById('tokenSearch').value.toLowerCase();
    
    tokenList.innerHTML = '';
    
    const filteredTokens = COMMON_TOKENS.filter(token => 
        token.symbol.toLowerCase().includes(searchTerm) ||
        token.name.toLowerCase().includes(searchTerm) ||
        token.address.toLowerCase().includes(searchTerm)
    );
    
    filteredTokens.forEach(token => {
        const tokenItem = document.createElement('div');
        tokenItem.className = 'token-item';
        tokenItem.dataset.address = token.address;
        tokenItem.dataset.symbol = token.symbol;
        tokenItem.dataset.decimals = token.decimals;
        tokenItem.dataset.name = token.name;
        tokenItem.dataset.icon = token.icon;
        
        tokenItem.innerHTML = `
            <img src="${token.icon}" alt="${token.symbol}" class="token-icon">
            <div class="token-details">
                <span class="token-symbol">${token.symbol}</span>
                <span class="token-name">${token.name}</span>
            </div>
        `;
        
        // 添加点击事件，选择代币并关闭模态框
        tokenItem.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            selectToken(tokenItem);
        });
        
        tokenList.appendChild(tokenItem);
    });
}

// 选择代币
function selectToken(token) {
    let tokenInfo;
    
    // 判断传入的是DOM元素还是token信息对象
    if (token.dataset) {
        // 如果是DOM元素，从dataset获取信息
        tokenInfo = {
        address: token.dataset.address,
        symbol: token.dataset.symbol,
        decimals: parseInt(token.dataset.decimals),
        name: token.dataset.name,
        icon: token.dataset.icon
    };
    } else {
        // 如果是token信息对象，直接使用
        tokenInfo = token;
    }
    
    console.log('选择代币:', tokenInfo, '类型:', selectedTokenType);
    
    // 验证代币信息
    if (!tokenInfo.address || tokenInfo.address === 'undefined') {
        showNotification({
            zh: '代币地址无效，请重新选择',
            en: 'Invalid token address, please reselect'
        }, 'error');
        console.error('代币地址无效:', tokenInfo);
        return;
    }
    
    if (!tokenInfo.symbol || tokenInfo.symbol === 'undefined') {
        showNotification({
            zh: '代币符号无效，请重新选择',
            en: 'Invalid token symbol, please reselect'
        }, 'error');
        console.error('代币符号无效:', tokenInfo);
        return;
    }
    
    // 检查代币重复
    if (selectedTokenType === 'from') {
        const toSymbol = document.getElementById('toTokenSelect').querySelector('.token-symbol')?.textContent;
        if (toSymbol && toSymbol === tokenInfo.symbol) {
            showNotification({
                zh: '不能选择相同的代币',
                en: 'Cannot select the same token'
            }, 'error');
            return;
        }
        updateTokenDisplay('fromTokenSelect', tokenInfo);
        updateBalance('fromBalance', tokenInfo);
    } else if (selectedTokenType === 'to') {
        const fromSymbol = document.getElementById('fromTokenSelect').querySelector('.token-symbol')?.textContent;
        if (fromSymbol && fromSymbol === tokenInfo.symbol) {
            showNotification({
                zh: '不能选择相同的代币',
                en: 'Cannot select the same token'
            }, 'error');
            return;
        }
        console.log('开始更新B框显示，tokenInfo:', tokenInfo);
        updateTokenDisplay('toTokenSelect', tokenInfo);
        updateBalance('toBalance', tokenInfo);
        
        // 重新计算交换输出
        calculateSwapOutput();
        
        // 验证更新结果
        setTimeout(() => {
            const toSelect = document.getElementById('toTokenSelect');
            const toSymbol = toSelect.querySelector('.token-symbol')?.textContent;
            console.log('B框更新完成，检查结果:', {
                toSymbol: toSymbol,
                dataset: toSelect.dataset.token
            });
        }, 50);
    } else if (selectedTokenType === 'liquidityA') {
        const liquidityBSymbol = document.getElementById('liquidityBTokenSelect').querySelector('.token-symbol')?.textContent;
        if (liquidityBSymbol && liquidityBSymbol === tokenInfo.symbol) {
            showNotification({
                zh: '不能选择相同的代币',
                en: 'Cannot select the same token'
            }, 'error');
            return;
        }
        updateTokenDisplay('liquidityATokenSelect', tokenInfo);
        updateBalance('liquidityABalance', tokenInfo);
        
        // 如果B代币也已选择，自动计算比例
        const liquidityBSelect = document.getElementById('liquidityBTokenSelect');
        if (liquidityBSelect.dataset.token) {
            const tokenB = JSON.parse(liquidityBSelect.dataset.token);
            calculateLiquidityAmounts(); // 不传参数，让函数自己判断
        }
        
        checkLiquidityForm();
        // 强制刷新按钮状态
        forceRefreshLiquidityButton();
    } else if (selectedTokenType === 'liquidityB') {
        const liquidityASymbol = document.getElementById('liquidityATokenSelect').querySelector('.token-symbol')?.textContent;
        if (liquidityASymbol && liquidityASymbol === tokenInfo.symbol) {
            showNotification({
                zh: '不能选择相同的代币',
                en: 'Cannot select the same token'
            }, 'error');
            return;
        }
        updateTokenDisplay('liquidityBTokenSelect', tokenInfo);
        updateBalance('liquidityBBalance', tokenInfo);
        
        // 如果A代币也已选择，自动计算比例
        const liquidityASelect = document.getElementById('liquidityATokenSelect');
        if (liquidityASelect.dataset.token) {
            const tokenA = JSON.parse(liquidityASelect.dataset.token);
            calculateLiquidityAmounts(); // 不传参数，让函数自己判断
        }
        
        checkLiquidityForm();
        // 强制刷新按钮状态
        forceRefreshLiquidityButton();
    } else if (selectedTokenType === 'searchTokenA') {
        const searchTokenBSymbol = document.getElementById('searchTokenBSelect').querySelector('.token-symbol')?.textContent;
        if (searchTokenBSymbol && searchTokenBSymbol === tokenInfo.symbol) {
            showNotification({
                zh: '不能选择相同的代币',
                en: 'Cannot select the same token'
            }, 'error');
            return;
        }
        updateTokenDisplay('searchTokenASelect', tokenInfo);
    } else if (selectedTokenType === 'searchTokenB') {
        const searchTokenASymbol = document.getElementById('searchTokenASelect').querySelector('.token-symbol')?.textContent;
        if (searchTokenASymbol && searchTokenASymbol === tokenInfo.symbol) {
            showNotification({
                zh: '不能选择相同的代币',
                en: 'Cannot select the same token'
            }, 'error');
            return;
        }
        updateTokenDisplay('searchTokenBSelect', tokenInfo);
    }
    
    // 保存当前选择的代币类型
    const currentTokenType = selectedTokenType;
    
    // 自动关闭代币选择窗口
    closeTokenModal();
    
    // 重新计算交换输出
    if (currentTokenType === 'from' || currentTokenType === 'to') {
        calculateSwapOutput();
    }
    
    console.log('代币选择完成，模态框已关闭');
}

// 更新代币显示
function updateTokenDisplay(selectId, tokenInfo) {
    console.log(`updateTokenDisplay调用: selectId=${selectId}, tokenInfo=`, tokenInfo);
    console.log(`调用堆栈:`, new Error().stack);
    
    // 防止重复调用保护
    if (selectId === 'toTokenSelect' && tokenInfo && tokenInfo.symbol) {
        const currentDataset = document.getElementById(selectId).dataset.token;
        if (currentDataset) {
            const currentToken = JSON.parse(currentDataset);
            if (currentToken.symbol === tokenInfo.symbol) {
                console.log(`跳过重复更新: ${selectId} 已经是 ${tokenInfo.symbol}`);
                return;
            }
        }
    }
    
    const select = document.getElementById(selectId);
    const tokenInfoDiv = select.querySelector('.token-info');
    
    if (tokenInfo) {
        // 显示选中的代币
        tokenInfoDiv.innerHTML = `
            <img src="${tokenInfo.icon}" alt="${tokenInfo.symbol}" class="token-icon">
            <span class="token-symbol">${tokenInfo.symbol}</span>
            <i class="fas fa-chevron-down"></i>
        `;
        tokenInfoDiv.classList.add('has-token');
        tokenInfoDiv.classList.remove('select-token-btn');
        
        // 保存代币信息到dataset
        select.dataset.token = JSON.stringify(tokenInfo);
        console.log(`代币显示更新完成: ${selectId} -> ${tokenInfo.symbol}`);
        
        // 验证更新结果
        setTimeout(() => {
            const updatedSelect = document.getElementById(selectId);
            const updatedTokenInfoDiv = updatedSelect.querySelector('.token-info');
            const updatedSymbol = updatedTokenInfoDiv.querySelector('.token-symbol')?.textContent;
            const hasTokenClass = updatedTokenInfoDiv.classList.contains('has-token');
            console.log(`验证更新结果: ${selectId}`, {
                symbol: updatedSymbol,
                hasTokenClass: hasTokenClass,
                innerHTML: updatedTokenInfoDiv.innerHTML
            });
        }, 100);
    } else {
        // 显示"选择代币"按钮
        const selectTokenText = currentLanguage === 'en' ? 'Select Token' : '选择代币';
        tokenInfoDiv.innerHTML = `
            <span class="select-token-text" data-text-zh="选择代币" data-text-en="Select Token">${selectTokenText}</span>
            <i class="fas fa-chevron-down"></i>
        `;
        tokenInfoDiv.classList.add('select-token-btn');
        tokenInfoDiv.classList.remove('has-token');
        
        // 清除代币信息
        delete select.dataset.token;
    }
    
    console.log(`更新代币显示: ${selectId}`, tokenInfo);
    
    // 如果tokenInfo为null或undefined，说明这是重置调用
    if (!tokenInfo) {
        console.log(`警告: ${selectId} 被重置为选择代币状态`);
    }
}

// 更新余额显示（立即执行版本）
async function updateBalance(balanceId, tokenInfo) {
    if (!userAccount || !web3) {
        const balanceText = currentLanguage === 'zh' ? '余额: 0' : 'Balance: 0';
        document.getElementById(balanceId).textContent = balanceText;
        return;
    }
    
    try {
        let balance;
        if (tokenInfo.address === '0x0000000000000000000000000000000000000000') {
            // GT余额
            balance = await web3.eth.getBalance(userAccount);
            balance = web3.utils.fromWei(balance, 'ether');
        } else {
            // ERC20代币余额 - 使用直接调用
            const tokenAddressChecksum = web3.utils.toChecksumAddress(tokenInfo.address);
            const accountAddressChecksum = web3.utils.toChecksumAddress(userAccount);
            
            const result = await web3.eth.call({
                to: tokenAddressChecksum,
                data: web3.eth.abi.encodeFunctionCall({
                    name: 'balanceOf',
                    type: 'function',
                    inputs: [{ type: 'address', name: 'account' }]
                }, [accountAddressChecksum])
            });
            balance = web3.utils.fromWei(result, tokenInfo.decimals === 6 ? 'mwei' : 'ether');
        }
        
        const balanceNum = parseFloat(balance);
        const balancePrefix = currentLanguage === 'zh' ? '余额: ' : 'Balance: ';
        
        if (balanceNum === 0) {
            document.getElementById(balanceId).textContent = balancePrefix + '0';
        } else if (balanceNum < 0.000001) {
            document.getElementById(balanceId).textContent = balancePrefix + '< 0.000001';
        } else {
            document.getElementById(balanceId).textContent = balancePrefix + balanceNum.toFixed(6);
        }
    } catch (error) {
        console.error('获取余额失败:', error);
        const errorText = currentLanguage === 'zh' ? '余额: 获取失败' : 'Balance: Failed';
        document.getElementById(balanceId).textContent = errorText;
    }
}

// 防抖版本的余额更新（用于频繁调用）
const updateBalanceDebounced = debounce(updateBalance, 300);

// 处理代币搜索
function handleTokenSearch() {
    console.log('=== handleTokenSearch 被调用 ===');
    
    const searchInput = document.getElementById('tokenSearch');
    if (!searchInput) {
        console.error('未找到搜索输入框');
        return;
    }
    
    const searchTerm = searchInput.value.trim().replace(/\s+/g, ''); // 去除所有空格
    const tokenList = document.getElementById('tokenList');

    console.log('搜索输入:', searchTerm);
    console.log('输入框值:', searchInput.value);

    // 更新输入框，去除空格
    if (searchInput.value !== searchTerm) {
        searchInput.value = searchTerm;
    }
    
    if (searchTerm.length === 0) {
        console.log('搜索词为空，显示默认列表');
        updateTokenList();
        return;
    }
    
    // 检查是否是合约地址
    if (searchTerm.startsWith('0x') && searchTerm.length === 42) {
        console.log('检测到合约地址，开始搜索:', searchTerm);
        // 立即显示loading状态
        tokenList.innerHTML = `<div class="searching">⏳ ${t('searchingContractInfo')}</div>`;
        // 开始搜索
        searchTokenByAddress(searchTerm);
    } else {
        console.log('普通搜索:', searchTerm);
        updateTokenList();
    }
}

// 通过合约地址搜索代币
async function searchTokenByAddress(address) {
    const tokenList = document.getElementById('tokenList');
    
    console.log('开始搜索合约地址:', address);
    
    if (!web3) {
        console.log('Web3未初始化，尝试重新初始化');
        if (window.ethereum) {
            web3 = new Web3(window.ethereum);
        } else {
            tokenList.innerHTML = `<div class="error">❌ ${t('pleaseConnectWallet')}</div>`;
        return;
        }
    }
    
    try {
        // 更新loading状态
        tokenList.innerHTML = `<div class="searching">🔍 ${t('checkingContractValidity')}</div>`;
        
        console.log('检查合约是否存在...');
        // 检查合约是否存在
        const code = await web3.eth.getCode(address);
        console.log('合约代码:', code);
        
        if (code === '0x') {
            tokenList.innerHTML = `<div class="error">❌ ${t('invalidContractAddress')}</div>`;
            return;
        }
        
        // 更新loading状态
        tokenList.innerHTML = `<div class="searching">📋 ${t('gettingTokenInfo')}</div>`;
        
        console.log('创建代币合约实例...');
        // 创建代币合约实例
        const tokenContract = new web3.eth.Contract(ERC20_ABI, address);
        
        console.log('获取代币信息...');
        // 获取代币信息（分别调用，避免并行问题）
        let tokenName = 'Unknown Token';
        let tokenSymbol = 'UNKNOWN';
        let tokenDecimals = 18;
        
        try {
            const nameResult = await tokenContract.methods.name().call();
            if (nameResult && nameResult.trim() !== '') {
                tokenName = nameResult;
            console.log('代币名称:', tokenName);
            } else {
                console.warn('代币名称为空，使用默认值');
            }
        } catch (error) {
            console.warn('获取代币名称失败:', error.message);
            // 尝试使用合约地址的后6位作为名称
            tokenName = `Token ${address.slice(-6)}`;
        }
        
        try {
            const symbolResult = await tokenContract.methods.symbol().call();
            if (symbolResult && symbolResult.trim() !== '') {
                tokenSymbol = symbolResult;
            console.log('代币符号:', tokenSymbol);
            } else {
                console.warn('代币符号为空，使用默认值');
            }
        } catch (error) {
            console.warn('获取代币符号失败:', error.message);
            // 尝试使用合约地址的后4位作为符号
            tokenSymbol = `TK${address.slice(-4)}`;
        }
        
        try {
            const decimalsResult = await tokenContract.methods.decimals().call();
            if (decimalsResult !== undefined && decimalsResult !== null) {
            tokenDecimals = parseInt(decimalsResult);
            console.log('代币精度:', tokenDecimals);
            } else {
                console.warn('代币精度为空，使用默认值18');
            }
        } catch (error) {
            console.warn('获取代币精度失败:', error.message);
            tokenDecimals = 18; // 默认精度
        }
        
        console.log('处理后的代币信息:', { tokenName, tokenSymbol, tokenDecimals });
        
        // 创建代币对象
        const token = {
            address: address,
            symbol: tokenSymbol,
            name: tokenName,
            decimals: tokenDecimals,
            icon: 'gt-logo.png' // 默认使用GT图标
        };
        
        console.log('显示搜索结果:', token);
        // 显示搜索结果
        displaySearchResult(token);
        
    } catch (error) {
        console.error('搜索代币失败:', error);
        tokenList.innerHTML = `<div class="error">❌ ${t('searchFailed')}: ${error.message}</div>`;
    }
}

// 显示搜索结果
function displaySearchResult(token) {
    const tokenList = document.getElementById('tokenList');
    tokenList.innerHTML = '';
    
    // 添加搜索结果标题
    const resultTitle = document.createElement('div');
    resultTitle.className = 'search-result-title';
    resultTitle.innerHTML = `<span>🔍 ${t('searchResults')}</span>`;
    tokenList.appendChild(resultTitle);
    
    const tokenItem = document.createElement('div');
    tokenItem.className = 'token-item search-result-item';
    tokenItem.dataset.address = token.address;
    tokenItem.dataset.symbol = token.symbol;
    tokenItem.dataset.decimals = token.decimals;
    tokenItem.dataset.name = token.name;
    tokenItem.dataset.icon = token.icon;
    
    tokenItem.innerHTML = `
        <img src="${token.icon}" alt="${token.symbol}" class="token-icon">
        <div class="token-details">
            <span class="token-symbol">${token.symbol}</span>
            <span class="token-name">${token.name}</span>
            <span class="token-address">${token.address.slice(0, 6)}...${token.address.slice(-4)}</span>
        </div>
        <div class="select-hint">${t('clickToSelectAsTarget')}</div>
    `;
    
    // 添加点击事件，选择代币
    tokenItem.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        console.log('点击搜索结果，当前selectedTokenType:', selectedTokenType);
        
        // 根据当前选择的代币类型来决定更新哪个选择器
        // selectedTokenType已经在openTokenModal中设置好了
        
        // 创建token信息对象
        const tokenInfo = {
            address: token.address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            icon: token.icon
        };
        
        // 调用selectToken函数，传入token信息对象
        console.log('准备调用selectToken，tokenInfo:', tokenInfo);
        selectToken(tokenInfo);
        
        // 关闭模态框
        closeTokenModal();
        
        // 显示成功提示
        let successMessage;
        if (selectedTokenType === 'to') {
            successMessage = `${t('selectedAsTarget')} ${token.symbol}`;
        } else if (selectedTokenType === 'liquidityA') {
            successMessage = currentLanguage === 'zh' ? `已选择代币A: ${token.symbol}` : `Selected Token A: ${token.symbol}`;
        } else if (selectedTokenType === 'liquidityB') {
            successMessage = currentLanguage === 'zh' ? `已选择代币B: ${token.symbol}` : `Selected Token B: ${token.symbol}`;
        } else {
            successMessage = `${t('selectedAsTarget')} ${token.symbol}`;
        }
        showNotification(successMessage, 'success');
        
        // 验证代币选择器是否更新
        setTimeout(() => {
            let selectId, selectElement, symbol;
            
            if (selectedTokenType === 'to') {
                selectId = 'toTokenSelect';
                selectElement = document.getElementById(selectId);
                symbol = selectElement.querySelector('.token-symbol')?.textContent;
            } else if (selectedTokenType === 'liquidityA') {
                selectId = 'liquidityATokenSelect';
                selectElement = document.getElementById(selectId);
                symbol = selectElement.querySelector('.token-symbol')?.textContent;
            } else if (selectedTokenType === 'liquidityB') {
                selectId = 'liquidityBTokenSelect';
                selectElement = document.getElementById(selectId);
                symbol = selectElement.querySelector('.token-symbol')?.textContent;
            }
            
            console.log(`${selectId}更新后检查:`, {
                selectElement: selectElement,
                symbol: symbol,
                dataset: selectElement?.dataset.token
            });
            
            // 如果选择器仍然显示"Select Token"，强制重新更新
            if (!symbol || symbol === 'Select Token' || symbol === '选择代币') {
                console.log(`检测到${selectId}显示异常，强制重新更新...`);
                const tokenInfo = JSON.parse(selectElement?.dataset.token || '{}');
                if (tokenInfo.symbol) {
                    updateTokenDisplay(selectId, tokenInfo);
                }
            }
        }, 100);
    });
    
    tokenList.appendChild(tokenItem);
}

// 交换代币位置
function swapTokens() {
    const fromSelect = document.getElementById('fromTokenSelect');
    const toSelect = document.getElementById('toTokenSelect');
    const fromAmount = document.getElementById('fromAmount');
    const toAmountDisplay = document.getElementById('toAmountDisplay');
    
    // 获取当前代币信息
    const fromToken = fromSelect.dataset.token;
    const toToken = toSelect.dataset.token;
    
    console.log('交换前状态:', {
        fromToken: fromToken,
        toToken: toToken,
        fromAmount: fromAmount.value,
        toAmountDisplay: toAmountDisplay.textContent
    });
    
    if (fromToken && toToken) {
        const fromTokenInfo = JSON.parse(fromToken);
        const toTokenInfo = JSON.parse(toToken);
        
        // 检查是否相同代币
        if (fromTokenInfo.symbol === toTokenInfo.symbol) {
            showNotification({
                zh: '不能交换相同的代币',
                en: 'Cannot swap the same token'
            }, 'error');
            return;
        }
        
        // 交换代币信息（上面换下面）
        updateTokenDisplay('fromTokenSelect', toTokenInfo);
        updateTokenDisplay('toTokenSelect', fromTokenInfo);
        updateBalance('fromBalance', toTokenInfo);
        updateBalance('toBalance', fromTokenInfo);
        
        console.log('代币位置已交换:', {
            from: toTokenInfo.symbol,
            to: fromTokenInfo.symbol
        });
    } else {
        // 如果没有代币信息，尝试通过显示内容获取
        const fromSymbol = fromSelect.querySelector('.token-symbol')?.textContent;
        const toSymbol = toSelect.querySelector('.token-symbol')?.textContent;
        
        if (fromSymbol && toSymbol) {
            console.log('通过显示内容交换:', { fromSymbol, toSymbol });
            
            // 交换显示内容
            const fromTokenInfoDiv = fromSelect.querySelector('.token-info');
            const toTokenInfoDiv = toSelect.querySelector('.token-info');
            
            if (fromTokenInfoDiv && toTokenInfoDiv) {
                const fromContent = fromTokenInfoDiv.innerHTML;
                const toContent = toTokenInfoDiv.innerHTML;
                
                fromTokenInfoDiv.innerHTML = toContent;
                toTokenInfoDiv.innerHTML = fromContent;
                
                console.log('显示内容已交换');
            }
        }
    }
    
    // 交换金额
    const fromValue = fromAmount.value;
    const toValue = toAmountDisplay.textContent;
    
    fromAmount.value = toValue;
    toAmountDisplay.textContent = fromValue;
    
    console.log('交换后状态:', {
        fromAmount: fromAmount.value,
        toAmountDisplay: toAmountDisplay.textContent
    });
    
    // 重新计算价格
    if (fromAmount.value) {
        calculateSwapOutput();
    }
}

// 处理金额输入（优化版，添加防抖）
const handleAmountInput = debounce(function() {
    calculateSwapOutput();
}, 500); // 500ms防抖，避免频繁计算

// 处理流动性金额输入（优化版，添加防抖）
const handleLiquidityAmountInput = debounce(function(event) {
    console.log('流动性金额输入变化:', event.target.id, event.target.value);
    
    // 自动计算流动性，传入变化的输入框ID
    calculateLiquidityAmounts(event.target.id);
    // 检查流动性表单完整性
    checkLiquidityForm();
    // 强制刷新按钮状态
    forceRefreshLiquidityButton();
}, 500); // 500ms防抖

// 计算流动性金额 - 支持双向自动计算
async function calculateLiquidityAmounts(changedInputId = null) {
    const selectA = document.getElementById('liquidityATokenSelect');
    const selectB = document.getElementById('liquidityBTokenSelect');
    const amountA = document.getElementById('liquidityAAmount');
    const amountB = document.getElementById('liquidityBAmount');
    
    const tokenA = selectA.dataset.token;
    const tokenB = selectB.dataset.token;
    
    if (!tokenA || !tokenB) {
        return;
    }
    
    try {
        const tokenAInfo = JSON.parse(tokenA);
        const tokenBInfo = JSON.parse(tokenB);
        
        // 检查是否是相同的代币
        if (tokenAInfo.symbol === tokenBInfo.symbol) {
            return;
        }
        
        const amountAValue = parseFloat(amountA.value) || 0;
        const amountBValue = parseFloat(amountB.value) || 0;
        
        // 获取代币价格比例
        const priceRatio = await getTokenPriceRatio(tokenAInfo, tokenBInfo);
        
        if (priceRatio !== null) {
            // 有交易对，根据价格比例自动计算
            console.log(`找到交易对，价格比例: ${priceRatio}`);
            
            // 根据变化的输入框来决定计算逻辑
            if (changedInputId === 'liquidityAAmount' && amountAValue > 0) {
                // 填入A，自动计算B
                const calculatedB = amountAValue * priceRatio;
                amountB.value = calculatedB.toFixed(6);
                console.log(`自动计算: ${amountAValue} ${tokenAInfo.symbol} = ${calculatedB.toFixed(6)} ${tokenBInfo.symbol}`);
                
                // 自动填充后，重新检查表单状态
                setTimeout(() => {
                    checkLiquidityForm();
                    forceRefreshLiquidityButton();
                }, 100);
            } else if (changedInputId === 'liquidityBAmount' && amountBValue > 0) {
                // 填入B，自动计算A
                const calculatedA = amountBValue / priceRatio;
                amountA.value = calculatedA.toFixed(6);
                console.log(`自动计算: ${amountBValue} ${tokenBInfo.symbol} = ${calculatedA.toFixed(6)} ${tokenAInfo.symbol}`);
                
                // 自动填充后，重新检查表单状态
                setTimeout(() => {
                    checkLiquidityForm();
                    forceRefreshLiquidityButton();
                }, 100);
            } else if (amountAValue > 0 && amountBValue > 0) {
                // 两个都有值，检查比例是否正确
                const currentRatio = amountAValue / amountBValue;
                const ratioDifference = Math.abs(currentRatio - priceRatio) / priceRatio;
                
                if (ratioDifference > 0.01) { // 如果偏差超过1%，提示用户
                    console.log(`价格比例偏差: 当前${currentRatio.toFixed(6)}, 市场${priceRatio.toFixed(6)}`);
                }
            }
            
            // 更新价格显示
            updateLiquidityPriceDisplay(tokenAInfo, tokenBInfo, priceRatio);
        } else {
            // 没有交易对，用户输入什么就是什么，不自动计算
            console.log(`没有找到交易对，用户输入什么就是什么`);
            
            // 更新价格显示为"创建新池子"
            const priceElement = document.querySelector('.liquidity-price');
            if (priceElement) {
                const createPoolText = currentLanguage === 'zh' ? '创建新池子' : 'Create New Pool';
                priceElement.textContent = createPoolText;
            }
        }
        
    } catch (error) {
        console.error('计算流动性金额失败:', error);
    }
}

// 获取代币价格比例 - 从工厂合约查询pair和reserves
async function getTokenPriceRatio(tokenA, tokenB) {
    try {
        console.log(`查询价格比例: ${tokenA.symbol} -> ${tokenB.symbol}`);
        
        // 处理GT和WGT的特殊情况
        let queryTokenA = tokenA;
        let queryTokenB = tokenB;
        
        // 如果tokenA是GT（没有合约地址），使用WGT地址查询
        if (tokenA.address === '0x0000000000000000000000000000000000000000') {
            queryTokenA = {
                ...tokenA,
                address: CONTRACT_ADDRESSES.WGT
            };
            console.log(`GT没有合约地址，使用WGT地址查询: ${CONTRACT_ADDRESSES.WGT}`);
        }
        
        // 如果tokenB是GT（没有合约地址），使用WGT地址查询
        if (tokenB.address === '0x0000000000000000000000000000000000000000') {
            queryTokenB = {
                ...tokenB,
                address: CONTRACT_ADDRESSES.WGT
            };
            console.log(`GT没有合约地址，使用WGT地址查询: ${CONTRACT_ADDRESSES.WGT}`);
        }
        
        // 检查是否有交易对
        const factory = new web3.eth.Contract([
            {
                "inputs": [
                    {"internalType": "address", "name": "tokenA", "type": "address"},
                    {"internalType": "address", "name": "tokenB", "type": "address"}
                ],
                "name": "getPair",
                "outputs": [
                    {"internalType": "address", "name": "pair", "type": "address"}
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ], CONTRACT_ADDRESSES.factory);
        
        const pairAddress = await factory.methods.getPair(queryTokenA.address, queryTokenB.address).call();
        console.log(`查询到的pair地址: ${pairAddress}`);
        
        if (pairAddress === '0x0000000000000000000000000000000000000000') {
            console.log('没有找到交易对，返回null表示无pair');
            return null; // 没有交易对时返回null
        }
        
        // 获取交易对的储备量和代币信息
        const pairContract = new web3.eth.Contract([
            {
                "inputs": [],
                "name": "getReserves",
                "outputs": [
                    {"internalType": "uint112", "name": "_reserve0", "type": "uint112"},
                    {"internalType": "uint112", "name": "_reserve1", "type": "uint112"},
                    {"internalType": "uint32", "name": "_blockTimestampLast", "type": "uint32"}
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "token0",
                "outputs": [
                    {"internalType": "address", "name": "", "type": "address"}
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "token1",
                "outputs": [
                    {"internalType": "address", "name": "", "type": "address"}
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ], pairAddress);
        
        const [reserves, token0Address, token1Address] = await Promise.all([
            pairContract.methods.getReserves().call(),
            pairContract.methods.token0().call(),
            pairContract.methods.token1().call()
        ]);
        
        // 查询代币精度
        const ERC20_ABI = [
            {
                "inputs": [],
                "name": "decimals",
                "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
                "stateMutability": "view",
                "type": "function"
            }
        ];
        
        const [token0Decimals, token1Decimals] = await Promise.all([
            new web3.eth.Contract(ERC20_ABI, token0Address).methods.decimals().call(),
            new web3.eth.Contract(ERC20_ABI, token1Address).methods.decimals().call()
        ]);
        
        console.log(`代币精度: token0(${token0Address})=${token0Decimals}, token1(${token1Address})=${token1Decimals}`);
        
        // 根据实际代币精度转换储备量
        const reserve0 = parseFloat(web3.utils.fromWei(reserves._reserve0, token0Decimals === 6 ? 'mwei' : 'ether'));
        const reserve1 = parseFloat(web3.utils.fromWei(reserves._reserve1, token1Decimals === 6 ? 'mwei' : 'ether'));
        
        console.log(`储备量: reserve0=${reserve0}, reserve1=${reserve1}`);
        console.log(`token0地址: ${token0Address}, token1地址: ${token1Address}`);
        console.log(`queryTokenA地址: ${queryTokenA.address}, queryTokenB地址: ${queryTokenB.address}`);
        
        // Uniswap V2 价格计算逻辑
        // 我们需要计算 1 tokenA = ? tokenB
        let priceRatio;
        
        if (queryTokenA.address.toLowerCase() === token0Address.toLowerCase()) {
            // tokenA 是 token0，tokenB 是 token1
            // 价格 = reserve1 / reserve0 (tokenB/tokenA)
            priceRatio = reserve1 / reserve0;
            console.log(`tokenA是token0，价格比例 = ${reserve1} / ${reserve0} = ${priceRatio}`);
        } else if (queryTokenA.address.toLowerCase() === token1Address.toLowerCase()) {
            // tokenA 是 token1，tokenB 是 token0  
            // 价格 = reserve0 / reserve1 (tokenB/tokenA)
            priceRatio = reserve0 / reserve1;
            console.log(`tokenA是token1，价格比例 = ${reserve0} / ${reserve1} = ${priceRatio}`);
        } else {
            console.error('代币地址不匹配，无法计算价格');
            return null;
        }
        
        console.log(`最终价格比例: 1 ${tokenA.symbol} = ${priceRatio} ${tokenB.symbol}`);
        return priceRatio;
        
    } catch (error) {
        console.error('获取价格比例失败:', error);
        return null; // 出错时返回null表示无pair
    }
}

// 更新流动性价格显示
function updateLiquidityPriceDisplay(tokenA, tokenB, priceRatio) {
    const priceElement = document.querySelector('.liquidity-price');
    if (priceElement) {
        priceElement.textContent = `1 ${tokenA.symbol} = ${priceRatio.toFixed(6)} ${tokenB.symbol}`;
    }
}

// 处理Swap界面的百分比选择
async function handleSwapPercentageSelect(event) {
    const percentage = parseInt(event.target.dataset.percentage);
    
    // 判断是From方框还是To方框的按钮
    const tokenInputBox = event.target.closest('.token-input');
    
    // 如果不在token-input容器内，说明是撤出流动性页面的按钮，直接返回
    if (!tokenInputBox) {
        return;
    }
    
    const isFromBox = tokenInputBox.querySelector('#fromTokenSelect');
    const isToBox = tokenInputBox.querySelector('#toTokenSelect');
    
    if (isFromBox) {
        // From方框的百分比按钮逻辑
    const fromAmountInput = document.getElementById('fromAmount');

        // 移除From方框所有按钮的active类
        tokenInputBox.querySelectorAll('.percentage-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // 添加active类到当前按钮
    event.target.classList.add('active');

    // 获取当前代币的余额
    const fromSelect = document.getElementById('fromTokenSelect');
    if (!fromSelect.dataset.token) {
            showNotification({
                zh: '请先选择代币',
                en: 'Please select a token first'
            }, 'error');
        return;
    }

    const fromToken = JSON.parse(fromSelect.dataset.token);

    // 获取代币余额
    try {
        let balance;
        if (fromToken.address === '0x0000000000000000000000000000000000000000') {
            // GT余额
            balance = await web3.eth.getBalance(userAccount);
            balance = web3.utils.fromWei(balance, 'ether');
        } else {
            // ERC20代币余额
            const contract = new web3.eth.Contract(ERC20_ABI, fromToken.address);
            balance = await contract.methods.balanceOf(userAccount).call();
            balance = web3.utils.fromWei(balance, fromToken.decimals === 6 ? 'mwei' : 'ether');
        }
        
        const balanceNum = parseFloat(balance);
        if (balanceNum > 0) {
            const amount = (balanceNum * percentage) / 100;
            fromAmountInput.value = amount.toFixed(6);

            // 触发金额输入事件，更新输出金额
            handleAmountInput();
        } else {
                showNotification({
                    zh: '余额不足',
                    en: 'Insufficient balance'
                }, 'error');
        }
    } catch (error) {
        console.error('获取余额失败:', error);
            showNotification({
                zh: '获取余额失败',
                en: 'Failed to get balance'
            }, 'error');
        }
    }
}

// 处理百分比选择
function handlePercentageSelect(event) {
    const percentage = parseInt(event.target.dataset.percentage);
    
    // 移除所有按钮的active类
    document.querySelectorAll('.percentage-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 添加active类到当前按钮
    event.target.classList.add('active');
    
    // 计算LP代币数量
    calculateLPAmount(percentage);
}

// 计算LP代币数量
async function calculateLPAmount(percentage) {
    const lpAmountInput = document.getElementById('lpTokenAmount');
    
    // 使用搜索到的流动性池信息
    if (!window.currentLiquidityPool) {
        showNotification({
            zh: '请先搜索流动性池',
            en: 'Please search liquidity pool first'
        }, 'warning');
        return;
    }
    
    try {
        const { tokenA, tokenB } = window.currentLiquidityPool;
        
        // 获取用户的LP代币余额
        const lpBalance = await getLPBalance(tokenA, tokenB);
        
        if (lpBalance > 0) {
            const lpAmount = (lpBalance * percentage) / 100;
            let lpAmountInt;
            
            // 智能取整：如果小数部分大于0.1，则向上取整；否则向下取整
            if (lpAmount - Math.floor(lpAmount) > 0.1) {
                lpAmountInt = Math.ceil(lpAmount);
            } else {
                lpAmountInt = Math.floor(lpAmount);
            }
            
            // 确保至少为1（避免0值）
            lpAmountInt = Math.max(1, lpAmountInt);
            
            lpAmountInput.value = lpAmountInt.toString();
            
            // 计算将收到的代币数量
            await calculateRemoveLiquidityAmounts(tokenA, tokenB, lpAmountInt);
        } else {
            lpAmountInput.value = '0';
            document.getElementById('removeTokenA').textContent = '0 GT';
            document.getElementById('removeTokenB').textContent = '0 WGT';
        }
        
    } catch (error) {
        console.error('计算LP代币数量失败:', error);
    }
}

// 获取流动性池的储备量和详细信息
async function getPoolReserves(tokenA, tokenB) {
    try {
        // 处理GT和WGT的特殊情况
        let queryTokenA = tokenA;
        let queryTokenB = tokenB;
        
        if (tokenA.address === '0x0000000000000000000000000000000000000000') {
            queryTokenA = {
                ...tokenA,
                address: CONTRACT_ADDRESSES.WGT
            };
        }
        
        if (tokenB.address === '0x0000000000000000000000000000000000000000') {
            queryTokenB = {
                ...tokenB,
                address: CONTRACT_ADDRESSES.WGT
            };
        }

        const factory = new web3.eth.Contract(FACTORY_ABI, CONTRACT_ADDRESSES.factory);
        const pairAddress = await factory.methods.getPair(queryTokenA.address, queryTokenB.address).call();
        
        if (pairAddress === '0x0000000000000000000000000000000000000000') {
            return null;
        }

        const pairContract = new web3.eth.Contract([
            {
                "inputs": [],
                "name": "getReserves",
                "outputs": [
                    {"internalType": "uint112", "name": "_reserve0", "type": "uint112"},
                    {"internalType": "uint112", "name": "_reserve1", "type": "uint112"},
                    {"internalType": "uint32", "name": "_blockTimestampLast", "type": "uint32"}
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "totalSupply",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "token0",
                "outputs": [{"internalType": "address", "name": "", "type": "address"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "token1",
                "outputs": [{"internalType": "address", "name": "", "type": "address"}],
                "stateMutability": "view",
                "type": "function"
            }
        ], pairAddress);

        const [reserves, totalSupply, token0Address, token1Address] = await Promise.all([
            pairContract.methods.getReserves().call(),
            pairContract.methods.totalSupply().call(),
            pairContract.methods.token0().call(),
            pairContract.methods.token1().call()
        ]);

        // 获取代币精度
        const ERC20_ABI_DECIMALS = [
            {
                "inputs": [],
                "name": "decimals",
                "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
                "stateMutability": "view",
                "type": "function"
            }
        ];

        const [token0Decimals, token1Decimals] = await Promise.all([
            new web3.eth.Contract(ERC20_ABI_DECIMALS, token0Address).methods.decimals().call(),
            new web3.eth.Contract(ERC20_ABI_DECIMALS, token1Address).methods.decimals().call()
        ]);

        const reserve0 = parseFloat(web3.utils.fromWei(reserves._reserve0, token0Decimals === 6 ? 'mwei' : 'ether'));
        const reserve1 = parseFloat(web3.utils.fromWei(reserves._reserve1, token1Decimals === 6 ? 'mwei' : 'ether'));
        const totalSupplyFloat = parseFloat(web3.utils.fromWei(totalSupply, 'ether'));

        return {
            pairAddress,
            reserve0,
            reserve1,
            totalSupply: totalSupplyFloat,
            token0Address,
            token1Address,
            token0Decimals: parseInt(token0Decimals),
            token1Decimals: parseInt(token1Decimals)
        };

    } catch (error) {
        console.error('获取池子储备量失败:', error);
        return null;
    }
}

// 计算预期收到的代币数量（带滑点保护）
function calculateExpectedAmounts(poolInfo, lpAmount, slippagePercent = 20) {
    if (!poolInfo) return null;

    const { reserve0, reserve1, totalSupply, token0Address, token1Address, token0Decimals, token1Decimals } = poolInfo;
    
    if (totalSupply <= 0) return null;

    console.log('计算参数:', {
        lpAmount,
        totalSupply,
        reserve0,
        reserve1,
        token0Decimals,
        token1Decimals
    });

    // 使用浮点数计算，然后转换为Wei
    const ratio = lpAmount / totalSupply;
    const expectedAmount0 = reserve0 * ratio;
    const expectedAmount1 = reserve1 * ratio;

    console.log('预期数量计算:', {
        ratio,
        expectedAmount0,
        expectedAmount1
    });

    // 应用滑点保护
    const slippageMultiplier = (100 - slippagePercent) / 100;
    const minAmount0 = expectedAmount0 * slippageMultiplier;
    const minAmount1 = expectedAmount1 * slippageMultiplier;

    console.log('滑点保护后:', {
        slippageMultiplier,
        minAmount0,
        minAmount1
    });

    // 转换为Wei格式的字符串
    const expectedAmount0Wei = web3.utils.toWei(expectedAmount0.toString(), token0Decimals === 6 ? 'mwei' : 'ether');
    const expectedAmount1Wei = web3.utils.toWei(expectedAmount1.toString(), token1Decimals === 6 ? 'mwei' : 'ether');
    const minAmount0Wei = web3.utils.toWei(minAmount0.toString(), token0Decimals === 6 ? 'mwei' : 'ether');
    const minAmount1Wei = web3.utils.toWei(minAmount1.toString(), token1Decimals === 6 ? 'mwei' : 'ether');

    console.log('Wei转换结果:', {
        expectedAmount0Wei,
        expectedAmount1Wei,
        minAmount0Wei,
        minAmount1Wei
    });

    return {
        expectedAmount0: expectedAmount0Wei,
        expectedAmount1: expectedAmount1Wei,
        minAmount0: minAmount0Wei,
        minAmount1: minAmount1Wei,
        token0Address,
        token1Address,
        token0Decimals,
        token1Decimals
    };
}

// 获取LP代币余额
async function getLPBalance(tokenA, tokenB) {
    try {
        if (!userAccount) {
            return 0;
        }

        // 处理GT和WGT的特殊情况
        let queryTokenA = tokenA;
        let queryTokenB = tokenB;
        
        // 如果tokenA是GT（没有合约地址），使用WGT地址查询
        if (tokenA.address === '0x0000000000000000000000000000000000000000') {
            queryTokenA = {
                ...tokenA,
                address: CONTRACT_ADDRESSES.WGT
            };
        }
        
        // 如果tokenB是GT（没有合约地址），使用WGT地址查询
        if (tokenB.address === '0x0000000000000000000000000000000000000000') {
            queryTokenB = {
                ...tokenB,
                address: CONTRACT_ADDRESSES.WGT
            };
        }

        // 获取流动性池地址
        const factory = new web3.eth.Contract([
            {
                "inputs": [
                    {"internalType": "address", "name": "tokenA", "type": "address"},
                    {"internalType": "address", "name": "tokenB", "type": "address"}
                ],
                "name": "getPair",
                "outputs": [
                    {"internalType": "address", "name": "pair", "type": "address"}
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ], CONTRACT_ADDRESSES.factory);
        
        const pairAddress = await factory.methods.getPair(queryTokenA.address, queryTokenB.address).call();
        
        if (pairAddress === '0x0000000000000000000000000000000000000000') {
            return 0;
        }
        
        // 获取LP代币余额
        const lpContract = new web3.eth.Contract([
            {
                "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
                "name": "balanceOf",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            }
        ], pairAddress);
        
        const balance = await lpContract.methods.balanceOf(userAccount).call();
        const balanceFloat = parseFloat(web3.utils.fromWei(balance, 'ether'));
        console.log('LP余额处理:', {
            原始余额: balanceFloat,
            Wei余额: balance
        });
        return balanceFloat; // 返回原始浮点数，让调用方决定如何处理
        
    } catch (error) {
        console.error('获取LP代币余额失败:', error);
        return 0;
    }
}

// 计算移除流动性后将收到的代币数量
async function calculateRemoveLiquidityAmounts(tokenA, tokenB, lpAmount) {
    try {
        // 处理GT和WGT的特殊情况
        let queryTokenA = tokenA;
        let queryTokenB = tokenB;
        
        // 如果tokenA是GT（没有合约地址），使用WGT地址查询
        if (tokenA.address === '0x0000000000000000000000000000000000000000') {
            queryTokenA = {
                ...tokenA,
                address: CONTRACT_ADDRESSES.WGT
            };
        }
        
        // 如果tokenB是GT（没有合约地址），使用WGT地址查询
        if (tokenB.address === '0x0000000000000000000000000000000000000000') {
            queryTokenB = {
                ...tokenB,
                address: CONTRACT_ADDRESSES.WGT
            };
        }

        // 获取流动性池地址
        const factory = new web3.eth.Contract([
            {
                "inputs": [
                    {"internalType": "address", "name": "tokenA", "type": "address"},
                    {"internalType": "address", "name": "tokenB", "type": "address"}
                ],
                "name": "getPair",
                "outputs": [
                    {"internalType": "address", "name": "pair", "type": "address"}
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ], CONTRACT_ADDRESSES.factory);
        
        const pairAddress = await factory.methods.getPair(queryTokenA.address, queryTokenB.address).call();
        
        if (pairAddress === '0x0000000000000000000000000000000000000000') {
            return;
        }
        
        // 获取流动性池信息
        const pairContract = new web3.eth.Contract([
            {
                "inputs": [],
                "name": "getReserves",
                "outputs": [
                    {"internalType": "uint112", "name": "_reserve0", "type": "uint112"},
                    {"internalType": "uint112", "name": "_reserve1", "type": "uint112"},
                    {"internalType": "uint32", "name": "_blockTimestampLast", "type": "uint32"}
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "totalSupply",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "token0",
                "outputs": [
                    {"internalType": "address", "name": "", "type": "address"}
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "token1",
                "outputs": [
                    {"internalType": "address", "name": "", "type": "address"}
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ], pairAddress);
        
        const [reserves, totalSupply, token0Address, token1Address] = await Promise.all([
            pairContract.methods.getReserves().call(),
            pairContract.methods.totalSupply().call(),
            pairContract.methods.token0().call(),
            pairContract.methods.token1().call()
        ]);
        
        // 查询代币精度
        const ERC20_ABI = [
            {
                "inputs": [],
                "name": "decimals",
                "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
                "stateMutability": "view",
                "type": "function"
            }
        ];
        
        const [token0Decimals, token1Decimals] = await Promise.all([
            new web3.eth.Contract(ERC20_ABI, token0Address).methods.decimals().call(),
            new web3.eth.Contract(ERC20_ABI, token1Address).methods.decimals().call()
        ]);
        
        // 根据实际代币精度转换储备量
        const reserve0 = parseFloat(web3.utils.fromWei(reserves._reserve0, token0Decimals === 6 ? 'mwei' : 'ether'));
        const reserve1 = parseFloat(web3.utils.fromWei(reserves._reserve1, token1Decimals === 6 ? 'mwei' : 'ether'));
        const totalSupplyFloat = parseFloat(web3.utils.fromWei(totalSupply, 'ether'));
        
        if (totalSupplyFloat > 0) {
            const ratio = lpAmount / totalSupplyFloat;
            
            // 确定tokenA和tokenB对应的储备量
            let amountA, amountB;
            if (queryTokenA.address.toLowerCase() === token0Address.toLowerCase()) {
                // tokenA是token0
                amountA = reserve0 * ratio;
                amountB = reserve1 * ratio;
            } else {
                // tokenA是token1
                amountA = reserve1 * ratio;
                amountB = reserve0 * ratio;
            }
            
            // 对金额进行取整处理，避免小数问题
            const amountAInt = Math.floor(amountA);
            const amountBInt = Math.floor(amountB);
            
            console.log('移除流动性金额计算:', {
                原始amountA: amountA,
                取整amountA: amountAInt,
                原始amountB: amountB,
                取整amountB: amountBInt
            });
            
            // 更新显示
            document.getElementById('removeTokenA').textContent = `${amountAInt} ${tokenA.symbol}`;
            document.getElementById('removeTokenB').textContent = `${amountBInt} ${tokenB.symbol}`;
        }
        
    } catch (error) {
        console.error('计算移除流动性金额失败:', error);
    }
}

// 检查流动性余额是否足够
async function checkLiquidityBalance(tokenA, tokenB, amountA, amountB, addLiquidityBtn) {
    try {
        if (!userAccount || !web3) {
            const noWalletText = currentLanguage === 'zh' ? '请先连接钱包' : 'Please connect wallet first';
            addLiquidityBtn.innerHTML = `<i class="fas fa-wallet"></i> ${noWalletText}`;
            addLiquidityBtn.disabled = true;
            addLiquidityBtn.className = 'liquidity-action-btn';
            
            // 确保按钮有图标
            if (!addLiquidityBtn.innerHTML.includes('<i class=')) {
                console.log('检测到钱包按钮缺少图标，立即修复');
                addLiquidityBtn.innerHTML = `<i class="fas fa-wallet"></i> ${noWalletText}`;
            }
            return;
        }

        const tokenAInfo = JSON.parse(tokenA);
        const tokenBInfo = JSON.parse(tokenB);
        
        // 获取代币A余额
        let balanceA;
        if (tokenAInfo.address === '0x0000000000000000000000000000000000000000') {
            balanceA = await web3.eth.getBalance(userAccount);
            balanceA = parseFloat(web3.utils.fromWei(balanceA, 'ether'));
        } else {
            const tokenAContract = new web3.eth.Contract(ERC20_ABI, tokenAInfo.address);
            const balanceAWei = await tokenAContract.methods.balanceOf(userAccount).call();
            balanceA = parseFloat(web3.utils.fromWei(balanceAWei, tokenAInfo.decimals === 6 ? 'mwei' : 'ether'));
        }
        
        // 获取代币B余额
        let balanceB;
        if (tokenBInfo.address === '0x0000000000000000000000000000000000000000') {
            balanceB = await web3.eth.getBalance(userAccount);
            balanceB = parseFloat(web3.utils.fromWei(balanceB, 'ether'));
        } else {
            const tokenBContract = new web3.eth.Contract(ERC20_ABI, tokenBInfo.address);
            const balanceBWei = await tokenBContract.methods.balanceOf(userAccount).call();
            balanceB = parseFloat(web3.utils.fromWei(balanceBWei, tokenBInfo.decimals === 6 ? 'mwei' : 'ether'));
        }
        
        const amountANum = parseFloat(amountA);
        const amountBNum = parseFloat(amountB);
        
        console.log('余额检查:', {
            balanceA: balanceA,
            balanceB: balanceB,
            amountA: amountANum,
            amountB: amountBNum,
            tokenA: tokenAInfo.symbol,
            tokenB: tokenBInfo.symbol
        });
        
        // 检查余额是否足够
        if (balanceA < amountANum) {
            const insufficientText = currentLanguage === 'zh' 
                ? `${tokenAInfo.symbol}余额不足` 
                : `Insufficient ${tokenAInfo.symbol} balance`;
            addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${insufficientText}`;
            addLiquidityBtn.disabled = true;
            addLiquidityBtn.className = 'liquidity-action-btn';
            
            // 确保按钮有图标
            if (!addLiquidityBtn.innerHTML.includes('<i class=')) {
                console.log('检测到代币A余额不足按钮缺少图标，立即修复');
                addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${insufficientText}`;
            }
            return;
        }
        
        if (balanceB < amountBNum) {
            const insufficientText = currentLanguage === 'zh' 
                ? `${tokenBInfo.symbol}余额不足` 
                : `Insufficient ${tokenBInfo.symbol} balance`;
            addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${insufficientText}`;
            addLiquidityBtn.disabled = true;
            addLiquidityBtn.className = 'liquidity-action-btn';
            
            // 确保按钮有图标
            if (!addLiquidityBtn.innerHTML.includes('<i class=')) {
                console.log('检测到代币B余额不足按钮缺少图标，立即修复');
                addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${insufficientText}`;
            }
            return;
        }
        
        // 检查是否有交易对和价格比例
        try {
            const priceRatio = await getTokenPriceRatio(tokenAInfo, tokenBInfo);
            
            if (priceRatio === null) {
                // 没有交易对，直接可以添加流动性（创建新池子）
                const createPoolText = currentLanguage === 'zh' ? '创建新池子' : 'Create New Pool';
                addLiquidityBtn.innerHTML = `<i class="fas fa-plus-circle"></i> ${createPoolText}`;
                addLiquidityBtn.disabled = false;
                addLiquidityBtn.className = 'liquidity-action-btn';
                
                // 确保按钮有图标
                if (!addLiquidityBtn.innerHTML.includes('<i class=')) {
                    console.log('检测到创建新池子按钮缺少图标，立即修复');
                    addLiquidityBtn.innerHTML = `<i class="fas fa-plus-circle"></i> ${createPoolText}`;
                }
                
                console.log('没有交易对：余额检查通过，可以创建新池子');
                return;
            }
            
            // 有交易对，检查价格比例是否合理
            const currentRatio = parseFloat(amountA) / parseFloat(amountB);
            const priceDifference = Math.abs(currentRatio - priceRatio) / priceRatio;
            
            // 如果价格偏差超过25%，提示用户
            if (priceDifference > 0.25) {
                const priceWarningText = currentLanguage === 'zh' 
                    ? '价格比例偏差较大' 
                    : 'Price ratio deviation too large';
                addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${priceWarningText}`;
                addLiquidityBtn.disabled = true;
                addLiquidityBtn.className = 'liquidity-action-btn';
                
                // 确保按钮有图标
                if (!addLiquidityBtn.innerHTML.includes('<i class=')) {
                    console.log('检测到价格偏差按钮缺少图标，立即修复');
                    addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${priceWarningText}`;
                }
                
                console.log('现有池子：价格偏差过大，无法添加流动性');
                return;
            }
            
            // 价格比例合理，可以添加流动性
            const addLiquidityText = currentLanguage === 'zh' ? '添加流动性' : 'Add Liquidity';
            addLiquidityBtn.innerHTML = `<i class="fas fa-plus-circle"></i> ${addLiquidityText}`;
            addLiquidityBtn.disabled = false;
            addLiquidityBtn.className = 'liquidity-action-btn';
            
            // 确保按钮有图标
            if (!addLiquidityBtn.innerHTML.includes('<i class=')) {
                console.log('检测到添加流动性按钮缺少图标，立即修复');
                addLiquidityBtn.innerHTML = `<i class="fas fa-plus-circle"></i> ${addLiquidityText}`;
            }
            
            console.log('现有池子：价格比例合理，可以添加流动性');
        } catch (error) {
            console.error('检查价格比例失败:', error);
            const priceErrorText = currentLanguage === 'zh' ? '价格检查失败' : 'Price check failed';
            addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${priceErrorText}`;
            addLiquidityBtn.disabled = true;
            addLiquidityBtn.className = 'liquidity-action-btn';
            
            // 确保按钮有图标
            if (!addLiquidityBtn.innerHTML.includes('<i class=')) {
                console.log('检测到价格检查失败按钮缺少图标，立即修复');
                addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${priceErrorText}`;
            }
        }
        
    } catch (error) {
        console.error('检查流动性余额失败:', error);
        const errorText = currentLanguage === 'zh' ? '检查余额失败' : 'Balance check failed';
        addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${errorText}`;
        addLiquidityBtn.disabled = true;
        addLiquidityBtn.className = 'liquidity-action-btn';
        
        // 确保按钮有图标
        if (!addLiquidityBtn.innerHTML.includes('<i class=')) {
            console.log('检测到错误状态按钮缺少图标，立即修复');
            addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${errorText}`;
        }
    }
}

// 检查是否是新池子
async function checkIfNewPool(tokenA, tokenB) {
    try {
        // 处理GT和WGT的特殊情况
        let queryTokenA = tokenA;
        let queryTokenB = tokenB;
        
        // 如果tokenA是GT（没有合约地址），使用WGT地址查询
        if (tokenA.address === '0x0000000000000000000000000000000000000000') {
            queryTokenA = {
                ...tokenA,
                address: CONTRACT_ADDRESSES.WGT
            };
        }
        
        // 如果tokenB是GT（没有合约地址），使用WGT地址查询
        if (tokenB.address === '0x0000000000000000000000000000000000000000') {
            queryTokenB = {
                ...tokenB,
                address: CONTRACT_ADDRESSES.WGT
            };
        }
        
        const factory = new web3.eth.Contract([
            {
                "inputs": [
                    {"internalType": "address", "name": "tokenA", "type": "address"},
                    {"internalType": "address", "name": "tokenB", "type": "address"}
                ],
                "name": "getPair",
                "outputs": [
                    {"internalType": "address", "name": "pair", "type": "address"}
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ], CONTRACT_ADDRESSES.factory);
        
        const pairAddress = await factory.methods.getPair(queryTokenA.address, queryTokenB.address).call();
        return pairAddress === '0x0000000000000000000000000000000000000000';
    } catch (error) {
        console.error('检查池子状态失败:', error);
        return false;
    }
}

// 强制刷新流动性按钮状态
function forceRefreshLiquidityButton() {
    const addLiquidityBtn = document.getElementById('addLiquidityBtn');
    if (!addLiquidityBtn) return;
    
    console.log('强制刷新按钮状态 - 当前状态:', {
        textContent: addLiquidityBtn.textContent,
        innerHTML: addLiquidityBtn.innerHTML,
        className: addLiquidityBtn.className,
        disabled: addLiquidityBtn.disabled
    });
    
    // 检查按钮是否缺少图标
    if (!addLiquidityBtn.innerHTML.includes('<i class=')) {
        console.log('检测到按钮缺少图标，重新设置状态');
        
        // 根据按钮文本内容重新设置图标
        const buttonText = addLiquidityBtn.textContent;
        
        if (buttonText.includes('Please fill') || buttonText.includes('请填写')) {
            addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${buttonText}`;
            addLiquidityBtn.className = 'liquidity-action-btn';
            addLiquidityBtn.disabled = true;
        } else if (buttonText.includes('Amount A') || buttonText.includes('Amount B') || buttonText.includes('金额A') || buttonText.includes('金额B')) {
            addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${buttonText}`;
            addLiquidityBtn.className = 'liquidity-action-btn';
            addLiquidityBtn.disabled = true;
        } else if (buttonText.includes('Insufficient') || buttonText.includes('余额不足')) {
            addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${buttonText}`;
            addLiquidityBtn.className = 'liquidity-action-btn';
            addLiquidityBtn.disabled = true;
        } else if (buttonText.includes('Cannot select') || buttonText.includes('不能选择')) {
            addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${buttonText}`;
            addLiquidityBtn.className = 'liquidity-action-btn';
            addLiquidityBtn.disabled = true;
        } else if (buttonText.includes('Please connect') || buttonText.includes('请先连接')) {
            addLiquidityBtn.innerHTML = `<i class="fas fa-wallet"></i> ${buttonText}`;
            addLiquidityBtn.className = 'liquidity-action-btn';
            addLiquidityBtn.disabled = true;
        } else if (buttonText.includes('Add Liquidity') || buttonText.includes('添加流动性')) {
            addLiquidityBtn.innerHTML = `<i class="fas fa-plus-circle"></i> ${buttonText}`;
            addLiquidityBtn.className = 'liquidity-action-btn';
            addLiquidityBtn.disabled = false;
        } else if (buttonText.includes('Create New Pool') || buttonText.includes('创建新池子')) {
            addLiquidityBtn.innerHTML = `<i class="fas fa-plus-circle"></i> ${buttonText}`;
            addLiquidityBtn.className = 'liquidity-action-btn';
            addLiquidityBtn.disabled = false;
        }
        
        console.log('强制刷新按钮状态 - 修复后:', {
            textContent: addLiquidityBtn.textContent,
            innerHTML: addLiquidityBtn.innerHTML,
            className: addLiquidityBtn.className,
            disabled: addLiquidityBtn.disabled
        });
    }
}

// 检查流动性表单完整性
function checkLiquidityForm() {
    const selectA = document.getElementById('liquidityATokenSelect');
    const selectB = document.getElementById('liquidityBTokenSelect');
    const tokenA = selectA.dataset.token;
    const tokenB = selectB.dataset.token;
    const amountA = document.getElementById('liquidityAAmount').value;
    const amountB = document.getElementById('liquidityBAmount').value;
    
    const addLiquidityBtn = document.getElementById('addLiquidityBtn');
    
    // 检查是否有代币选择（通过检查显示内容）
    const tokenASymbol = selectA.querySelector('.token-symbol')?.textContent;
    const tokenBSymbol = selectB.querySelector('.token-symbol')?.textContent;
    
    console.log('检查流动性表单:', {
        tokenA: tokenA,
        tokenB: tokenB,
        amountA: amountA,
        amountB: amountB,
        tokenASymbol: tokenASymbol,
        tokenBSymbol: tokenBSymbol
    });
    
    // 检查表单完整性 - 更宽松的验证
    const hasTokenA = tokenASymbol && tokenASymbol.trim() !== '';
    const hasTokenB = tokenBSymbol && tokenBSymbol.trim() !== '';
    const hasAmountA = amountA && parseFloat(amountA) > 0;
    const hasAmountB = amountB && parseFloat(amountB) > 0;
    
    console.log('验证结果:', {
        hasTokenA,
        hasTokenB,
        hasAmountA,
        hasAmountB
    });
    
    if (hasTokenA && hasTokenB && hasAmountA && hasAmountB) {
        // 检查代币是否相同
        if (tokenASymbol === tokenBSymbol) {
            const sameTokenText = currentLanguage === 'zh' ? '不能选择相同代币' : 'Cannot select same token';
            addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${sameTokenText}`;
            addLiquidityBtn.disabled = true;
            addLiquidityBtn.className = 'liquidity-action-btn';
            
            // 确保按钮有图标
            if (!addLiquidityBtn.innerHTML.includes('<i class=')) {
                console.log('检测到相同代币按钮缺少图标，立即修复');
                addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${sameTokenText}`;
            }
        } else {
            // 检查余额是否足够
            checkLiquidityBalance(tokenA, tokenB, amountA, amountB, addLiquidityBtn);
        }
    } else {
        // 显示具体缺少什么
        let missingItems = [];
        if (!hasTokenA) missingItems.push(currentLanguage === 'zh' ? '代币A' : 'Token A');
        if (!hasTokenB) missingItems.push(currentLanguage === 'zh' ? '代币B' : 'Token B');
        if (!hasAmountA) missingItems.push(currentLanguage === 'zh' ? '金额A' : 'Amount A');
        if (!hasAmountB) missingItems.push(currentLanguage === 'zh' ? '金额B' : 'Amount B');
        
            const fillText = currentLanguage === 'zh' ? '请填写' : 'Please fill ';
            const separator = currentLanguage === 'zh' ? '、' : ', ';
            const buttonText = `${fillText}${missingItems.join(separator)}`;
        addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${buttonText}`;
        addLiquidityBtn.disabled = true;
        addLiquidityBtn.className = 'liquidity-action-btn';
        
        console.log('设置按钮状态 - 信息不完整:', {
            buttonText: buttonText,
            innerHTML: addLiquidityBtn.innerHTML,
            className: addLiquidityBtn.className,
            disabled: addLiquidityBtn.disabled
        });
        
        // 确保按钮有图标
        if (!addLiquidityBtn.innerHTML.includes('<i class=')) {
            console.log('检测到按钮缺少图标，立即修复');
            addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${buttonText}`;
        }
    }
}

// 设置最大金额
async function setMaxAmount(type) {
    if (!userAccount) {
        showNotification({
            zh: '请先连接钱包',
            en: 'Please connect wallet first'
        }, 'error');
        return;
    }
    
    let selectId, amountId;
    if (type === 'from') {
        selectId = 'fromTokenSelect';
        amountId = 'fromAmount';
    } else if (type === 'liquidityA') {
        selectId = 'liquidityATokenSelect';
        amountId = 'liquidityAAmount';
    } else if (type === 'liquidityB') {
        selectId = 'liquidityBTokenSelect';
        amountId = 'liquidityBAmount';
    }
    
    const select = document.getElementById(selectId);
    const tokenData = select.dataset.token;
    
    if (!tokenData) {
        showNotification({
            zh: '请先选择代币',
            en: 'Please select a token first'
        }, 'error');
        return;
    }
    
    const tokenInfo = JSON.parse(tokenData);
    let balance;
    
    try {
        if (tokenInfo.address === '0x0000000000000000000000000000000000000000') {
            balance = await web3.eth.getBalance(userAccount);
            balance = web3.utils.fromWei(balance, 'ether');
        } else {
            const contract = new web3.eth.Contract(ERC20_ABI, tokenInfo.address);
            balance = await contract.methods.balanceOf(userAccount).call();
            balance = web3.utils.fromWei(balance, tokenInfo.decimals === 6 ? 'mwei' : 'ether');
        }
        
        document.getElementById(amountId).value = parseFloat(balance).toFixed(6);
        
        if (type === 'from') {
            calculateSwapOutput();
        }
    } catch (error) {
        console.error('获取余额失败:', error);
        showNotification({
            zh: '获取余额失败',
            en: 'Failed to get balance'
        }, 'error');
    }
}

// 计算交换输出
async function calculateSwapOutput() {
    const fromAmount = document.getElementById('fromAmount').value;
    const fromSelect = document.getElementById('fromTokenSelect');
    const toSelect = document.getElementById('toTokenSelect');
    
    console.log('开始计算交换输出:', {
        fromAmount: fromAmount,
        fromSelect: fromSelect.dataset.token,
        toSelect: toSelect.dataset.token
    });
    
    // 检查是否选择了"到"代币
    if (!toSelect.dataset.token) {
        console.log('未选择目标代币');
        document.getElementById('toAmountDisplay').textContent = t('pleaseSelectToken');
        return;
    }
    
    if (!fromAmount || !fromSelect.dataset.token) {
        console.log('缺少输入金额或源代币');
        document.getElementById('toAmountDisplay').textContent = '0.0';
        return;
    }
    
    const fromToken = JSON.parse(fromSelect.dataset.token);
    const toToken = JSON.parse(toSelect.dataset.token);
    
    console.log('代币信息:', {
        fromToken: fromToken,
        toToken: toToken
    });
    
    if (fromToken.address === toToken.address) {
        document.getElementById('toAmountDisplay').textContent = fromAmount;
        return;
    }
    
    // 检查是否是GT和WGT之间的直接转换
    if ((fromToken.symbol === 'GT' && toToken.symbol === 'WGT') || 
        (fromToken.symbol === 'WGT' && toToken.symbol === 'GT')) {
        // GT和WGT之间是1:1转换
        document.getElementById('toAmountDisplay').textContent = fromAmount;
        document.getElementById('currentPrice').textContent = `1 ${fromToken.symbol} = 1.0 ${toToken.symbol}`;
        return;
    }
    
    try {
        // 检查Web3连接
        if (!web3) {
            document.getElementById('toAmountDisplay').textContent = '0.0';
            return;
        }
        
        // 检查流动性
        const hasLiquidity = await checkLiquidity(fromToken, toToken);
        if (!hasLiquidity) {
            // 显示估算值而不是"流动性不足"
            const amountNum = parseFloat(fromAmount);
            if (!isNaN(amountNum) && amountNum > 0) {
                // 显示一个简单的估算值（假设1:1比例，考虑滑点）
                const estimatedOutput = (amountNum * 0.9).toFixed(6); // 假设10%的滑点
                document.getElementById('toAmountDisplay').textContent = estimatedOutput;
                document.getElementById('currentPrice').textContent = `1 ${fromToken.symbol} ≈ 0.9 ${toToken.symbol} (估算)`;
            } else {
                document.getElementById('toAmountDisplay').textContent = '0.0';
                document.getElementById('currentPrice').textContent = '请输入有效金额';
            }
            return;
        }
        
        const router = new web3.eth.Contract(ROUTER_ABI, CONTRACT_ADDRESSES.router);
        
        // 构建交换路径
        let path;
        console.log('构建交换路径:', {
            fromTokenAddress: fromToken.address,
            toTokenAddress: toToken.address,
            WGTAddress: CONTRACT_ADDRESSES.WGT
        });
        
        if (fromToken.address === '0x0000000000000000000000000000000000000000') {
            // GT -> Token
            if (toToken.address === CONTRACT_ADDRESSES.WGT) {
                // GT -> WGT: 直接转换，不需要通过router
                console.log('GT -> WGT: 直接转换');
                const outputAmount = parseFloat(fromAmount).toFixed(6);
                document.getElementById('toAmountDisplay').textContent = outputAmount;
                document.getElementById('currentPrice').textContent = `1 ${fromToken.symbol} = 1.0 ${toToken.symbol}`;
                return; // 已经在上面处理了
            } else {
                // GT -> Token: GT -> WETH -> Token
                path = [CONTRACT_ADDRESSES.WGT, toToken.address];
                console.log('GT -> Token路径:', path);
            }
        } else if (toToken.address === '0x0000000000000000000000000000000000000000') {
            // Token -> GT
            if (fromToken.address === CONTRACT_ADDRESSES.WGT) {
                // WGT -> GT: 直接转换，不需要通过router
                console.log('WGT -> GT: 直接转换');
                const outputAmount = parseFloat(fromAmount).toFixed(6);
                document.getElementById('toAmountDisplay').textContent = outputAmount;
                document.getElementById('currentPrice').textContent = `1 ${fromToken.symbol} = 1.0 ${toToken.symbol}`;
                return; // 已经在上面处理了
            } else {
                // Token -> GT: Token -> WETH
                path = [fromToken.address, CONTRACT_ADDRESSES.WGT];
                console.log('Token -> GT路径:', path);
            }
        } else {
            // Token -> Token
            if (fromToken.address === CONTRACT_ADDRESSES.WGT && toToken.address === CONTRACT_ADDRESSES.WGT) {
                // WGT到WGT的转换无效
                console.log('WGT到WGT的转换无效');
                document.getElementById('toAmountDisplay').textContent = '0.0';
                document.getElementById('currentPrice').textContent = '无效的转换';
                return;
            } else if (fromToken.address === CONTRACT_ADDRESSES.WGT) {
                // WGT -> Token: 直接交换
                path = [fromToken.address, toToken.address];
                console.log('WGT -> Token路径:', path);
            } else if (toToken.address === CONTRACT_ADDRESSES.WGT) {
                // Token -> WGT: 直接交换
                path = [fromToken.address, toToken.address];
                console.log('Token -> WGT路径:', path);
            } else {
                // Token -> Token: Token -> WETH -> Token
                path = [fromToken.address, CONTRACT_ADDRESSES.WGT, toToken.address];
                console.log('Token -> Token路径:', path);
            }
        }
        
        // 验证输入金额
        const amountNum = parseFloat(fromAmount);
        if (isNaN(amountNum) || amountNum <= 0) {
            console.error('无效的输入金额:', fromAmount);
            document.getElementById('toAmountDisplay').textContent = '0.0';
            return;
        }
        
        const amountIn = web3.utils.toWei(amountNum.toString(), fromToken.decimals === 6 ? 'mwei' : 'ether');
        
        try {
            console.log('调用router.getAmountsOut:', {
                amountIn: amountIn,
                path: path
            });
            
            const amounts = await router.methods.getAmountsOut(amountIn, path).call();
            console.log('Router返回结果:', amounts);
            
            const amountOut = web3.utils.fromWei(amounts[amounts.length - 1], toToken.decimals === 6 ? 'mwei' : 'ether');
            console.log('转换后的输出金额:', amountOut);
            
            const outputAmount = parseFloat(amountOut).toFixed(6);
            document.getElementById('toAmountDisplay').textContent = outputAmount;
            
            // 更新价格显示
            const price = parseFloat(amountOut) / amountNum;
            document.getElementById('currentPrice').textContent = `1 ${fromToken.symbol} = ${price.toFixed(6)} ${toToken.symbol}`;
            
            console.log('最终显示:', {
                outputAmount: outputAmount,
                price: price.toFixed(6)
            });
        } catch (routerError) {
            console.log('Router计算失败，显示估算值:', routerError.message);
            // 如果router计算失败，显示一个估算值
            const amountNum = parseFloat(fromAmount);
            if (!isNaN(amountNum) && amountNum > 0) {
                // 显示一个简单的估算值（1:1比例作为示例）
                const estimatedOutput = (amountNum * 0.95).toFixed(6); // 假设5%的滑点
                document.getElementById('toAmountDisplay').textContent = estimatedOutput;
                document.getElementById('currentPrice').textContent = `1 ${fromToken.symbol} ≈ 0.95 ${toToken.symbol} (估算)`;
            } else {
                document.getElementById('toAmountDisplay').textContent = '0.0';
                document.getElementById('currentPrice').textContent = '价格计算失败';
            }
        }
        
    } catch (error) {
        console.error('计算价格失败:', error);
        document.getElementById('toAmountDisplay').textContent = '计算失败';
        document.getElementById('currentPrice').textContent = '价格计算失败';
    }
}

// 检查流动性
async function checkLiquidity(fromToken, toToken) {
    try {
        if (!web3) return false;
        
        // 如果是GT和WGT之间的转换，直接返回true（1:1转换）
        if ((fromToken.symbol === 'GT' && toToken.symbol === 'WGT') || 
            (fromToken.symbol === 'WGT' && toToken.symbol === 'GT')) {
            return true;
        }
        
        const router = new web3.eth.Contract(ROUTER_ABI, CONTRACT_ADDRESSES.router);
        
        // 构建交换路径
        let path;
        if (fromToken.address === '0x0000000000000000000000000000000000000000') {
            // GT -> Token
            if (toToken.address === CONTRACT_ADDRESSES.WGT) {
                // GT -> WGT: 直接转换，不需要通过router
                return true; // 已经在上面处理了
            } else {
                // GT -> Token: GT -> WETH -> Token
                path = [CONTRACT_ADDRESSES.WGT, toToken.address];
            }
        } else if (toToken.address === '0x0000000000000000000000000000000000000000') {
            // Token -> GT
            if (fromToken.address === CONTRACT_ADDRESSES.WGT) {
                // WGT -> GT: 直接转换，不需要通过router
                return true; // 已经在上面处理了
            } else {
                // Token -> GT: Token -> WETH
                path = [fromToken.address, CONTRACT_ADDRESSES.WGT];
            }
        } else {
            // Token -> Token
            if (fromToken.address === CONTRACT_ADDRESSES.WGT && toToken.address === CONTRACT_ADDRESSES.WGT) {
                // WGT到WGT的转换无效
                return false;
            } else if (fromToken.address === CONTRACT_ADDRESSES.WGT) {
                // WGT -> Token: 直接交换
                path = [fromToken.address, toToken.address];
            } else if (toToken.address === CONTRACT_ADDRESSES.WGT) {
                // Token -> WGT: 直接交换
                path = [fromToken.address, toToken.address];
            } else {
                // Token -> Token: Token -> WETH -> Token
                path = [fromToken.address, CONTRACT_ADDRESSES.WGT, toToken.address];
            }
        }
        
        // 使用实际输入金额检查流动性
        const fromAmount = document.getElementById('fromAmount').value;
        const amountNum = parseFloat(fromAmount);
        if (!fromAmount || isNaN(amountNum) || amountNum <= 0) {
            return false;
        }
        
        const amountIn = web3.utils.toWei(amountNum.toString(), fromToken.decimals === 6 ? 'mwei' : 'ether');
        
        try {
            const amounts = await router.methods.getAmountsOut(amountIn, path).call();
            const hasLiquidity = amounts && amounts.length > 0 && amounts[amounts.length - 1] > 0;
            console.log('流动性检查结果:', {
                fromToken: fromToken.symbol,
                toToken: toToken.symbol,
                path: path,
                amountIn: fromAmount,
                amounts: amounts,
                hasLiquidity: hasLiquidity
            });
            return hasLiquidity;
        } catch (error) {
            console.log('流动性检查失败:', error.message);
            // 如果router检查失败，可能是网络问题或合约问题，让用户尝试
            console.log('允许用户尝试交换，让合约自己判断流动性');
            return true; // 返回true，让用户尝试交换
        }
        
    } catch (error) {
        console.error('流动性检查异常:', error);
        return true; // 发生异常时返回true，让用户尝试
    }
}

// 执行交换
async function executeSwap() {
    if (!userAccount) {
        // 如果未连接钱包，直接调用连接钱包功能
        await connectWallet();
        return;
    }
    
    const fromAmount = document.getElementById('fromAmount').value;
    const toAmountDisplay = document.getElementById('toAmountDisplay').textContent;
    const fromSelect = document.getElementById('fromTokenSelect');
    const toSelect = document.getElementById('toTokenSelect');
    
    // 检查代币选择（通过显示内容）
    const fromSymbol = fromSelect.querySelector('.token-symbol')?.textContent;
    const toSymbol = toSelect.querySelector('.token-symbol')?.textContent;
    
    console.log('检查swap表单:', {
        fromAmount,
        toAmountDisplay,
        fromSymbol,
        toSymbol,
        fromToken: fromSelect.dataset.token,
        toToken: toSelect.dataset.token
    });
    
    // 验证输入
    const hasFromToken = fromSymbol && fromSymbol.trim() !== '';
    const hasToToken = toSelect.dataset.token; // 检查是否选择了代币
    const hasFromAmount = fromAmount && parseFloat(fromAmount) > 0;
    const hasValidOutput = toAmountDisplay && toAmountDisplay !== '0.0' && toAmountDisplay !== t('pleaseSelectToken') && !toAmountDisplay.includes('计算失败');
    
    if (!hasFromToken || !hasToToken || !hasFromAmount || !hasValidOutput) {
        let missingItems = [];
        if (!hasFromToken) missingItems.push('源代币');
        if (!hasToToken) missingItems.push('目标代币');
        if (!hasFromAmount) missingItems.push('交换金额');
        if (!hasValidOutput) missingItems.push('有效输出金额');
        
        showNotification({
            zh: `请填写${missingItems.join('、')}`,
            en: `Please fill in ${missingItems.join(', ')}`
        }, 'error');
        return;
    }
    
    const swapMessage = currentLanguage === 'zh' ? '正在兑换中...' : 'Swapping...';
    showLoading(true, swapMessage);
    
    try {
        const fromToken = JSON.parse(fromSelect.dataset.token);
        const toToken = JSON.parse(toSelect.dataset.token);
        
        // 检查授权额度（仅对非GT代币）
        if (fromToken.address !== '0x0000000000000000000000000000000000000000') {
            console.log('🔍 检查输入代币授权额度:', {
                tokenSymbol: fromToken.symbol,
                tokenAddress: fromToken.address,
                amount: fromAmount,
                routerAddress: CONTRACT_ADDRESSES.router
            });
            
            const hasEnoughAllowance = await checkTokenAllowance(
                fromToken.address, 
                CONTRACT_ADDRESSES.router, 
                fromAmount
            );
            
            console.log('📊 授权额度检查结果:', hasEnoughAllowance);
            
            if (!hasEnoughAllowance) {
                console.log('⚠️ 授权额度不足，开始授权...');
                // 自动授权，显示授权中提示
                const approvalSuccess = await approveToken(
                    fromToken.address, 
                    CONTRACT_ADDRESSES.router, 
                    fromAmount
                );
                
                if (!approvalSuccess) {
                    console.log('❌ 授权失败，停止执行');
                    return; // 授权失败，停止执行
                }
                console.log('✅ 授权成功，继续执行交换');
            } else {
                console.log('✅ 授权额度充足，跳过授权步骤，直接进行交换');
            }
        } else {
            console.log('💰 GT代币（原生代币），跳过授权检查');
        }
        
        // 检查是否是GT和WGT之间的直接转换
        if ((fromToken.symbol === 'GT' && toToken.symbol === 'WGT') || 
            (fromToken.symbol === 'WGT' && toToken.symbol === 'GT')) {
            await handleGTWGTConversion(fromToken, toToken, fromAmount);
        } else {
            // 使用router进行交换
            await handleRouterSwap(fromToken, toToken, fromAmount, toAmountDisplay);
        }
        
        // 根据当前语言显示成功提示
        const swapSuccessMessage = currentLanguage === 'zh' ? '交换成功！' : 'Swap successful!';
        showNotification(swapSuccessMessage, 'success');
        
        // 更新余额
        updateBalance('fromBalance', fromToken);
        updateBalance('toBalance', toToken);
        
    } catch (error) {
        console.error('交换失败:', error);
        
        // 根据当前语言显示错误提示
        let errorMessage = currentLanguage === 'zh' ? '交换失败' : 'Swap failed';
        
        if (error.message.includes('insufficient funds')) {
            errorMessage = currentLanguage === 'zh' ? '余额不足' : 'Insufficient funds';
        } else if (error.message.includes('user rejected')) {
            errorMessage = currentLanguage === 'zh' ? '用户取消交易' : 'Transaction cancelled by user';
        } else if (error.message.includes('gas')) {
            errorMessage = currentLanguage === 'zh' ? 'Gas费用不足' : 'Insufficient gas';
        } else if (error.message.includes('Transaction has been reverted')) {
            errorMessage = currentLanguage === 'zh' ? '交易被回滚，可能是流动性不足或交易对不存在' : 'Transaction reverted, possibly insufficient liquidity or pair not found';
        } else if (error.message.includes('交易对不存在')) {
            errorMessage = currentLanguage === 'zh' ? '交易对不存在，请检查代币地址' : 'Trading pair not found, please check token addresses';
        } else if (error.message.includes('INSUFFICIENT_OUTPUT_AMOUNT')) {
            errorMessage = currentLanguage === 'zh' ? '输出金额不足，请调整滑点或减少交易量' : 'Insufficient output amount, please adjust slippage or reduce trade size';
        } else if (error.message.includes('INSUFFICIENT_LIQUIDITY')) {
            errorMessage = currentLanguage === 'zh' ? '流动性不足' : 'Insufficient liquidity';
        } else if (error.message.includes('EXPIRED')) {
            errorMessage = currentLanguage === 'zh' ? '交易已过期，请重新尝试' : 'Transaction expired, please try again';
        } else if (error.message.includes('bytes32') || error.message.includes('validation')) {
            errorMessage = currentLanguage === 'zh' ? '数值格式错误，请检查输入金额是否包含小数' : 'Value format error, please check if input amount contains decimals';
        } else {
            errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
    } finally {
        showLoading(false);
    }
}

// 处理GT和WGT之间的转换
async function handleGTWGTConversion(fromToken, toToken, amount) {
    const amountIn = web3.utils.toWei(amount, 'ether');
    
    if (fromToken.symbol === 'GT' && toToken.symbol === 'WGT') {
        // GT -> WGT (包装)
        const wgtContract = new web3.eth.Contract(WGT_ABI, CONTRACT_ADDRESSES.WGT);
        await wgtContract.methods.deposit().send({
            from: userAccount,
            value: amountIn
        });
    } else if (fromToken.symbol === 'WGT' && toToken.symbol === 'GT') {
        // WGT -> GT (解包)
        const wgtContract = new web3.eth.Contract(WGT_ABI, CONTRACT_ADDRESSES.WGT);
        await wgtContract.methods.withdraw(amountIn).send({
            from: userAccount
        });
    }
}

// 处理通过router的交换
async function handleRouterSwap(fromToken, toToken, fromAmount, toAmountDisplay) {
    const router = new web3.eth.Contract(ROUTER_ABI, CONTRACT_ADDRESSES.router);
    
    // 验证输入金额
    const amountNum = parseFloat(fromAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
        showNotification({
            zh: '无效的输入金额',
            en: 'Invalid input amount'
        }, 'error');
        return;
    }
    
    // 确保输入金额是整数（避免小数导致的bytes32验证错误）
    // GT代币不需要取整，其他ERC20代币需要取整
    const amountIn = fromToken.address === '0x0000000000000000000000000000000000000000' 
        ? web3.utils.toWei(amountNum.toString(), 'ether')
        : web3.utils.toWei(Math.floor(amountNum).toString(), fromToken.decimals === 6 ? 'mwei' : 'ether');
    
    // 验证输出金额
    const outputNum = parseFloat(toAmountDisplay);
    if (isNaN(outputNum) || outputNum <= 0) {
        showNotification({
            zh: '无效的输出金额',
            en: 'Invalid output amount'
        }, 'error');
        return;
    }
    
    // 如果是估算值，使用更宽松的最小输出金额
    const isEstimated = toAmountDisplay.includes('估算') || toAmountDisplay.includes('≈');
    const slippageMultiplier = isEstimated ? 0.8 : (1 - slippage / 100); // 估算值使用20%滑点
    
    // 确保输出金额是整数（避免小数导致的bytes32验证错误）
    // TOKEN A作为输出时，如果不是GT代币，也需要取整
    const amountOutMin = toToken.address === '0x0000000000000000000000000000000000000000' 
        ? web3.utils.toWei((outputNum * slippageMultiplier).toString(), 'ether')  // GT代币不取整
        : web3.utils.toWei(
            Math.floor(outputNum * slippageMultiplier).toString(),
        toToken.decimals === 6 ? 'mwei' : 'ether'
        ); // 其他ERC20代币取整
    
    // 验证代币地址
    if (!fromToken.address || fromToken.address === 'undefined' || fromToken.address === '') {
        throw new Error('源代币地址无效');
    }
    if (!toToken.address || toToken.address === 'undefined' || toToken.address === '') {
        throw new Error('目标代币地址无效');
    }
    
    // 确保地址格式正确
    const fromTokenAddress = web3.utils.toChecksumAddress(fromToken.address);
    const toTokenAddress = web3.utils.toChecksumAddress(toToken.address);
    const wgtAddress = web3.utils.toChecksumAddress(CONTRACT_ADDRESSES.WGT);
    
    console.log('代币地址验证:', {
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        wgtAddress: wgtAddress,
        fromTokenOriginal: fromToken.address,
        toTokenOriginal: toToken.address
    });
    
    // 构建交换路径
    let path;
    if (fromTokenAddress === '0x0000000000000000000000000000000000000000') {
        // GT -> Token
        if (toTokenAddress === wgtAddress) {
            // GT -> WGT: 直接转换，不需要通过router
            throw new Error('GT到WGT的转换应该使用handleGTWGTConversion函数');
        } else {
            // GT -> Token: GT -> WETH -> Token
            path = [wgtAddress, toTokenAddress];
        }
    } else if (toTokenAddress === '0x0000000000000000000000000000000000000000') {
        // Token -> GT
        if (fromTokenAddress === wgtAddress) {
            // WGT -> GT: 直接转换，不需要通过router
            throw new Error('WGT到GT的转换应该使用handleGTWGTConversion函数');
        } else {
            // Token -> GT: Token -> WETH
            path = [fromTokenAddress, wgtAddress];
        }
    } else {
        // Token -> Token
        if (fromTokenAddress === wgtAddress && toTokenAddress === wgtAddress) {
            throw new Error('WGT到WGT的转换无效');
        } else if (fromTokenAddress === wgtAddress) {
            // WGT -> Token: 直接交换
            path = [fromTokenAddress, toTokenAddress];
        } else if (toTokenAddress === wgtAddress) {
            // Token -> WGT: 直接交换
            path = [fromTokenAddress, toTokenAddress];
        } else {
            // Token -> Token: Token -> WETH -> Token
            path = [fromTokenAddress, wgtAddress, toTokenAddress];
        }
    }
    
    const deadlineValue = document.getElementById('deadline').value || '20';
    const deadline = Math.floor(Date.now() / 1000) + (parseInt(deadlineValue) * 60);
    
    // 验证deadline是否为有效数字
    if (isNaN(deadline) || deadline <= 0) {
        throw new Error('无效的deadline值');
    }
    
    console.log('交换参数:', {
        fromToken: fromToken,
        toToken: toToken,
        amountIn: amountIn,
        amountOutMin: amountOutMin,
        path: path,
        pathType: typeof path,
        pathIsArray: Array.isArray(path),
        deadline: deadline,
        userAccount: userAccount
    });
    
    // 验证路径数组
    if (!Array.isArray(path) || path.length < 2) {
        throw new Error('无效的交换路径');
    }
    
    // 验证所有地址都是有效的
    for (let i = 0; i < path.length; i++) {
        if (!web3.utils.isAddress(path[i])) {
            throw new Error(`路径中第${i}个地址无效: ${path[i]}`);
        }
    }
    
    // 验证用户账户地址
    if (!web3.utils.isAddress(userAccount)) {
        throw new Error('无效的用户账户地址');
    }
    
    // 检查流动性池是否存在
    try {
        const factory = new web3.eth.Contract([
            {
                "inputs": [
                    {"internalType": "address", "name": "tokenA", "type": "address"},
                    {"internalType": "address", "name": "tokenB", "type": "address"}
                ],
                "name": "getPair",
                "outputs": [
                    {"internalType": "address", "name": "pair", "type": "address"}
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ], CONTRACT_ADDRESSES.factory);
        
        if (path.length >= 2) {
            const pairAddress = await factory.methods.getPair(path[0], path[1]).call();
            if (pairAddress === '0x0000000000000000000000000000000000000000') {
                throw new Error('交易对不存在，请检查代币地址');
            }
            console.log('交易对地址:', pairAddress);
        }
    } catch (error) {
        console.warn('流动性检查失败:', error.message);
    }
    
    let tx;
    
    if (fromTokenAddress === '0x0000000000000000000000000000000000000000') {
        // GT -> Token
        console.log('执行GT -> Token交换:', {
            amountOutMin: amountOutMin,
            path: path,
            userAccount: userAccount,
            deadline: deadline,
            value: amountIn
        });
        
        tx = await router.methods.swapExactETHForTokens(
            amountOutMin,
            path,
            userAccount,
            deadline
        ).send({
            from: userAccount,
            value: amountIn,
            gas: 300000 // 增加gas限制
        });
    } else if (toTokenAddress === '0x0000000000000000000000000000000000000000') {
        // Token -> GT
        console.log('执行Token -> GT交换，跳过重复授权（已在executeSwap中处理）');
        
        tx = await router.methods.swapExactTokensForETH(
            amountIn,
            amountOutMin,
            path,
            userAccount,
            deadline
        ).send({
            from: userAccount
        });
    } else {
        // Token -> Token
        console.log('执行Token -> Token交换，跳过重复授权（已在executeSwap中处理）');
        
        tx = await router.methods.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            userAccount,
            deadline
        ).send({
            from: userAccount
        });
    }
    
    console.log('交易哈希:', tx.transactionHash);
}

// 执行添加流动性
async function executeAddLiquidity() {
    if (!userAccount) {
        showNotification(t('connectWalletFirst'), 'error');
        return;
    }
    
    const amountA = document.getElementById('liquidityAAmount').value;
    const amountB = document.getElementById('liquidityBAmount').value;
    const selectA = document.getElementById('liquidityATokenSelect');
    const selectB = document.getElementById('liquidityBTokenSelect');
    
    if (!amountA || !amountB || !selectA.dataset.token || !selectB.dataset.token) {
        showNotification(t('fillCompleteInfo'), 'error');
        return;
    }
    
    // 检查代币是否相同
    const tokenA = JSON.parse(selectA.dataset.token);
    const tokenB = JSON.parse(selectB.dataset.token);
    
    if (tokenA.symbol === tokenB.symbol) {
        showNotification(t('sameToken'), 'error');
        return;
    }
    
    const liquidityMessage = currentLanguage === 'zh' ? '正在添加流动性...' : 'Adding liquidity...';
    showLoading(true, liquidityMessage);
    
    try {
        // 检查是否是新池子
        const isNewPool = await checkIfNewPool(tokenA, tokenB);
        
        if (isNewPool) {
            console.log('检测到新池子，需要初始化');
            // 新池子需要初始化，使用更严格的滑点保护
            const initSlippage = 0.5; // 新池子使用0.5%滑点
            const amountADesired = web3.utils.toWei(amountA, tokenA.decimals === 6 ? 'mwei' : 'ether');
            const amountBDesired = web3.utils.toWei(amountB, tokenB.decimals === 6 ? 'mwei' : 'ether');
            const amountAMin = web3.utils.toWei(
                (parseFloat(amountA) * (1 - initSlippage / 100)).toString(),
                tokenA.decimals === 6 ? 'mwei' : 'ether'
            );
            const amountBMin = web3.utils.toWei(
                (parseFloat(amountB) * (1 - initSlippage / 100)).toString(),
                tokenB.decimals === 6 ? 'mwei' : 'ether'
            );
            const deadline = Math.floor(Date.now() / 1000) + (parseInt(document.getElementById('deadline').value) * 60);
            
            console.log('新池子初始化参数:', {
                amountADesired: amountADesired,
                amountBDesired: amountBDesired,
                amountAMin: amountAMin,
                amountBMin: amountBMin,
                deadline: deadline,
                slippage: initSlippage
            });
            
            // 显示警告
            showNotification({
                zh: '正在创建新池子，请确认价格比例正确',
                en: 'Creating new pool, please confirm price ratio is correct'
            }, 'warning');
            
        } else {
            console.log('现有池子，添加流动性');
            // 现有池子，使用用户设置的滑点
        const amountADesired = web3.utils.toWei(amountA, tokenA.decimals === 6 ? 'mwei' : 'ether');
        const amountBDesired = web3.utils.toWei(amountB, tokenB.decimals === 6 ? 'mwei' : 'ether');
        const amountAMin = web3.utils.toWei(
            (parseFloat(amountA) * (1 - slippage / 100)).toString(),
            tokenA.decimals === 6 ? 'mwei' : 'ether'
        );
        const amountBMin = web3.utils.toWei(
            (parseFloat(amountB) * (1 - slippage / 100)).toString(),
            tokenB.decimals === 6 ? 'mwei' : 'ether'
        );
        const deadline = Math.floor(Date.now() / 1000) + (parseInt(document.getElementById('deadline').value) * 60);
            
            console.log('现有池子参数:', {
                amountADesired: amountADesired,
                amountBDesired: amountBDesired,
                amountAMin: amountAMin,
                amountBMin: amountBMin,
                deadline: deadline,
                slippage: slippage
            });
        }
        
        const router = new web3.eth.Contract(ROUTER_ABI, CONTRACT_ADDRESSES.router);
        
        // 使用统一的参数计算
        const finalSlippage = isNewPool ? 0.5 : slippage;
        const amountADesired = web3.utils.toWei(amountA, tokenA.decimals === 6 ? 'mwei' : 'ether');
        const amountBDesired = web3.utils.toWei(amountB, tokenB.decimals === 6 ? 'mwei' : 'ether');
        const amountAMin = web3.utils.toWei(
            (parseFloat(amountA) * (1 - finalSlippage / 100)).toString(),
            tokenA.decimals === 6 ? 'mwei' : 'ether'
        );
        const amountBMin = web3.utils.toWei(
            (parseFloat(amountB) * (1 - finalSlippage / 100)).toString(),
            tokenB.decimals === 6 ? 'mwei' : 'ether'
        );
        const deadline = Math.floor(Date.now() / 1000) + (parseInt(document.getElementById('deadline').value) * 60);
        
        console.log('最终流动性参数:', {
            isNewPool: isNewPool,
            finalSlippage: finalSlippage,
            amountADesired: amountADesired,
            amountBDesired: amountBDesired,
            amountAMin: amountAMin,
            amountBMin: amountBMin,
            deadline: deadline
        });
        
        let tx;
        
        if (tokenA.address === '0x0000000000000000000000000000000000000000' || tokenB.address === '0x0000000000000000000000000000000000000000') {
            // 包含GT的流动性添加
            const token = tokenA.address === '0x0000000000000000000000000000000000000000' ? tokenB : tokenA;
            const amountTokenDesired = tokenA.address === '0x0000000000000000000000000000000000000000' ? amountBDesired : amountADesired;
            const amountTokenMin = tokenA.address === '0x0000000000000000000000000000000000000000' ? amountBMin : amountAMin;
            const amountETHMin = tokenA.address === '0x0000000000000000000000000000000000000000' ? amountAMin : amountBMin;
            
            // 先授权代币
            const tokenContract = new web3.eth.Contract(ERC20_ABI, token.address);
            await tokenContract.methods.approve(CONTRACT_ADDRESSES.router, amountTokenDesired).send({
                from: userAccount
            });
            
            tx = await router.methods.addLiquidityETH(
                token.address,
                amountTokenDesired,
                amountTokenMin,
                amountETHMin,
                userAccount,
                deadline
            ).send({
                from: userAccount,
                value: tokenA.address === '0x0000000000000000000000000000000000000000' ? amountADesired : amountBDesired
            });
        } else {
            // Token -> Token 流动性添加
            // 先授权两个代币
            const tokenAContract = new web3.eth.Contract(ERC20_ABI, tokenA.address);
            const tokenBContract = new web3.eth.Contract(ERC20_ABI, tokenB.address);
            
            await tokenAContract.methods.approve(CONTRACT_ADDRESSES.router, amountADesired).send({
                from: userAccount
            });
            await tokenBContract.methods.approve(CONTRACT_ADDRESSES.router, amountBDesired).send({
                from: userAccount
            });
            
            tx = await router.methods.addLiquidity(
                tokenA.address,
                tokenB.address,
                amountADesired,
                amountBDesired,
                amountAMin,
                amountBMin,
                userAccount,
                deadline
            ).send({
                from: userAccount
            });
        }
        
        showNotification(t('liquidityAdded'), 'success');
        console.log('交易哈希:', tx.transactionHash);
        
        // 更新余额
        updateBalance('liquidityABalance', tokenA);
        updateBalance('liquidityBBalance', tokenB);
        
    } catch (error) {
        console.error('添加流动性失败:', error);
        showNotification(t('addLiquidityFailed') + ': ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// 执行撤出流动性
async function executeRemoveLiquidity() {
    if (!userAccount) {
        showNotification(t('connectWalletFirst'), 'error');
        return;
    }
    
    const lpAmount = document.getElementById('lpTokenAmount').value;
    
    // 使用搜索到的流动性池信息
    if (!window.currentLiquidityPool) {
        showNotification({
            zh: '请先搜索流动性池',
            en: 'Please search liquidity pool first'
        }, 'error');
        return;
    }
    
    if (!lpAmount || parseFloat(lpAmount) <= 0) {
        showNotification({
            zh: '请输入有效的LP数量',
            en: 'Please enter valid LP amount'
        }, 'error');
        return;
    }
    
    const { tokenA, tokenB, queryTokenA, queryTokenB } = window.currentLiquidityPool;
    
    const removeLiquidityMessage = currentLanguage === 'zh' ? '正在撤出流动性...' : 'Removing liquidity...';
    showLoading(true, removeLiquidityMessage);
    
    try {
        const router = new web3.eth.Contract(ROUTER_ABI, CONTRACT_ADDRESSES.router);
        const factory = new web3.eth.Contract(FACTORY_ABI, CONTRACT_ADDRESSES.factory);
        
        // 对LP数量进行智能取整处理，避免bytes32验证错误
        const lpAmountFloat = parseFloat(lpAmount);
        let lpAmountInt;
        
        // 如果小数部分大于0.1，则向上取整；否则向下取整
        if (lpAmountFloat - Math.floor(lpAmountFloat) > 0.1) {
            lpAmountInt = Math.ceil(lpAmountFloat);
        } else {
            lpAmountInt = Math.floor(lpAmountFloat);
        }
        
        // 确保至少为1（避免0值）
        lpAmountInt = Math.max(1, lpAmountInt);
        
        const lpAmountWei = web3.utils.toWei(lpAmountInt.toString(), 'ether');
        const deadlineElement = document.getElementById('deadline');
        const deadlineMinutes = deadlineElement ? parseInt(deadlineElement.value) : 20;
        const deadline = Math.floor(Date.now() / 1000) + (deadlineMinutes * 60);
        
        // 确保deadline是整数（Uniswap标准）
        const deadlineInt = Math.floor(deadline);
        
        console.log('Deadline处理:', {
            当前时间: Math.floor(Date.now() / 1000),
            截止时间分钟: deadlineMinutes,
            原始deadline: deadline,
            取整deadline: deadlineInt
        });
        
        console.log('LP数量处理:', {
            原始值: lpAmount,
            浮点数: lpAmountFloat,
            取整后: lpAmountInt,
            Wei值: lpAmountWei,
            取整后类型: typeof lpAmountInt,
            Wei值类型: typeof lpAmountWei
        });
        
        // 检查LP代币授权
        const pairAddress = await factory.methods.getPair(queryTokenA.address, queryTokenB.address).call();
        if (pairAddress === '0x0000000000000000000000000000000000000000') {
            throw new Error('Pair not found');
        }
        
        // 检查LP代币余额
        const lpContract = new web3.eth.Contract([
            {
                "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
                "name": "balanceOf",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            }
        ], pairAddress);
        
        const lpBalanceWei = await lpContract.methods.balanceOf(userAccount).call();
        const lpBalanceWeiString = lpBalanceWei.toString();
        
        console.log('LP代币余额检查:', {
            pairAddress: pairAddress,
            lpBalanceWei: lpBalanceWeiString,
            lpBalanceWeiType: typeof lpBalanceWeiString
        });
        
        // 直接使用Wei格式的余额，避免精度损失
        let actualLpAmountWei;
        
        // 如果用户输入的数量太大，使用99.9%的实际余额
        const userAmountWei = web3.utils.toWei(lpAmountInt.toString(), 'ether');
        if (BigInt(userAmountWei) > BigInt(lpBalanceWeiString)) {
            // 使用99.9%的实际余额，避免精度问题
            const percentage = BigInt(999); // 99.9%
            const actualAmountBigInt = (BigInt(lpBalanceWeiString) * percentage) / BigInt(1000);
            actualLpAmountWei = actualAmountBigInt.toString();
            
            console.log('使用99.9%的实际余额:', {
                用户输入Wei: userAmountWei,
                实际余额Wei: lpBalanceWeiString,
                使用数量Wei: actualLpAmountWei,
                百分比: '99.9%'
            });
        } else {
            actualLpAmountWei = userAmountWei;
            console.log('使用用户输入数量:', {
                用户输入Wei: userAmountWei,
                实际余额Wei: lpBalanceWeiString
            });
        }
        
        
        // 获取池子储备量信息
        const poolInfo = await getPoolReserves(tokenA, tokenB);
        if (!poolInfo) {
            throw new Error('无法获取池子信息');
        }
        
        console.log('池子储备量信息:', poolInfo);
        
        // 检查池子储备量是否极不平衡
        const reserveRatio = Math.max(poolInfo.reserve0, poolInfo.reserve1) / Math.min(poolInfo.reserve0, poolInfo.reserve1);
        if (reserveRatio > 1000000) { // 如果比例超过100万:1
            console.warn('警告：池子储备量极不平衡！', {
                储备量比例: `${reserveRatio.toFixed(2)}:1`,
                建议: '建议先测试少量撤出（如1个LP代币）'
            });
            
            showNotification({
                zh: `警告：池子储备量极不平衡（${reserveRatio.toFixed(0)}:1），建议先测试少量撤出`,
                en: `Warning: Extremely unbalanced pool reserves (${reserveRatio.toFixed(0)}:1), suggest testing small amount first`
            }, 'warning');
        }
        
        // 计算预期收到的代币数量（带20%滑点保护，Uniswap标准）
        const expectedAmounts = calculateExpectedAmounts(poolInfo, actualLpAmount, 20);
        if (!expectedAmounts) {
            throw new Error('无法计算预期代币数量');
        }
        
        console.log('预期代币数量计算:', expectedAmounts);
        
        // 检查LP代币授权，如果不足则使用最大授权
        const lpAllowance = await checkTokenAllowance(pairAddress, CONTRACT_ADDRESSES.router, actualLpAmountWei);
        if (!lpAllowance) {
            console.log('LP代币授权不足，开始最大授权...');
            const approvalSuccess = await approveTokenMax(pairAddress, CONTRACT_ADDRESSES.router);
            if (!approvalSuccess) {
                throw new Error('LP代币授权失败');
            }
        }
        
        let tx;
        
        if (tokenA.address === '0x0000000000000000000000000000000000000000' || tokenB.address === '0x0000000000000000000000000000000000000000') {
            // 包含GT的流动性撤出 - 使用removeLiquidityETH
            const token = tokenA.address === '0x0000000000000000000000000000000000000000' ? queryTokenB : queryTokenA;
            
            console.log('撤出包含GT的流动性:', {
                token: token.symbol,
                tokenAddress: token.address,
                lpAmount: lpAmount,
                lpAmountWei: lpAmountWei,
                deadline: deadlineInt,
                userAccount: userAccount
            });
            
        // 为了避免ds-math-sub-underflow错误，直接使用0作为最小接受金额
        // 这对于储备量极不平衡的池子特别重要
        let amountTokenMin = '0';
        let amountETHMin = '0';
        
        console.log('使用0作为最小接受金额以避免下溢错误');
        
        
        console.log('合约调用参数:', {
            tokenAddress: token.address,
            liquidity: actualLpAmountWei,
            amountTokenMin: amountTokenMin,
            amountETHMin: amountETHMin,
            to: userAccount,
            deadline: deadlineInt
        });
        
        // 验证合约地址
        console.log('合约地址验证:', {
            routerAddress: CONTRACT_ADDRESSES.router,
            factoryAddress: CONTRACT_ADDRESSES.factory,
            tokenAddress: token.address,
            pairAddress: pairAddress
        });
            
            // 尝试使用更保守的gas设置
            const txData = {
                from: userAccount,
                gas: 500000, // 增加gas limit
                gasPrice: web3.utils.toWei('10', 'gwei') // 降低gas price
            };
            
            console.log('发送交易数据:', txData);
            
            // 先尝试估算gas来验证参数
            try {
                const gasEstimate = await router.methods.removeLiquidityETH(
                    token.address,
                    actualLpAmountWei,
                    amountTokenMin,
                    amountETHMin,
                    userAccount,
                    deadlineInt
                ).estimateGas({ from: userAccount });
                
                console.log('Gas估算成功:', gasEstimate);
                txData.gas = Math.floor(gasEstimate * 1.2); // 增加20%的缓冲
            } catch (gasError) {
                console.log('Gas估算失败，使用固定Gas设置:', gasError);
                // 使用固定的Gas设置，避免复杂的备用逻辑
                txData.gas = 500000;
            }
            
            tx = await router.methods.removeLiquidityETH(
                token.address,
                actualLpAmountWei,
                amountTokenMin,
                amountETHMin,
                userAccount,
                deadlineInt
            ).send(txData);
        } else {
            // Token -> Token 流动性撤出 - 使用removeLiquidity
            console.log('撤出Token-Token流动性:', {
                tokenA: queryTokenA.symbol,
                tokenB: queryTokenB.symbol,
                lpAmount: lpAmount,
                deadline: deadlineInt
            });
            
            // 使用更兼容的参数格式
            const txData = {
                from: userAccount,
                gas: 300000,
                gasPrice: web3.utils.toWei('20', 'gwei')
            };
            
            console.log('发送交易数据:', txData);
            
            // 先尝试估算gas来验证参数
            try {
                const gasEstimate = await router.methods.removeLiquidity(
                    queryTokenA.address,
                    queryTokenB.address,
                    actualLpAmountWei,
                    amountTokenMin,
                    amountETHMin,
                    userAccount,
                    deadlineInt
                ).estimateGas({ from: userAccount });
                
                console.log('Gas估算成功:', gasEstimate);
                txData.gas = Math.floor(gasEstimate * 1.2);
            } catch (gasError) {
                console.log('Gas估算失败，使用固定Gas设置:', gasError);
                // 使用固定的Gas设置，避免复杂的备用逻辑
                txData.gas = 500000;
            }
            
            tx = await router.methods.removeLiquidity(
                queryTokenA.address,
                queryTokenB.address,
                actualLpAmountWei,
                amountTokenMin,
                amountETHMin,
                userAccount,
                deadlineInt
            ).send(txData);
        }
        
        showNotification({
            zh: '流动性撤出成功',
            en: 'Liquidity removed successfully'
        }, 'success');
        console.log('交易哈希:', tx.transactionHash);
        
        // 更新余额
        updateBalance('liquidityABalance', tokenA);
        updateBalance('liquidityBBalance', tokenB);
        
        // 更新LP余额显示
        const lpTokenBalance = document.getElementById('lpTokenBalance');
        if (lpTokenBalance) {
            const newLPBalance = await getLPBalance(tokenA, tokenB);
            lpTokenBalance.textContent = currentLanguage === 'zh' ? `余额: ${newLPBalance.toFixed(6)}` : `Balance: ${newLPBalance.toFixed(6)}`;
        }
        
        // 重新搜索流动性池以更新信息
        setTimeout(() => {
            searchLiquidityPool();
        }, 2000);
        
    } catch (error) {
        console.error('撤出流动性失败:', error);
        
        // 详细的错误诊断
        let errorMessage = {
            zh: '撤出流动性失败',
            en: 'Failed to remove liquidity'
        };
        
        if (error.message && error.message.includes('bytes32')) {
            errorMessage = {
                zh: '参数验证失败，请检查输入值',
                en: 'Parameter validation failed, please check input values'
            };
        } else if (error.message && error.message.includes('insufficient')) {
            errorMessage = {
                zh: '余额不足或授权不足',
                en: 'Insufficient balance or allowance'
            };
        } else if (error.message && error.message.includes('deadline')) {
            errorMessage = {
                zh: '交易已过期，请重试',
                en: 'Transaction expired, please try again'
            };
        } else if (error.message && error.message.includes('ds-math-sub-underflow')) {
            errorMessage = {
                zh: '数学下溢错误：池子储备量极不平衡导致计算错误。建议：1) 先少量测试撤出（如1个LP代币）2) 如果成功再逐步增加 3) 考虑重新部署储备量更平衡的池子',
                en: 'Math underflow error: Extremely unbalanced pool reserves causing calculation error. Suggestions: 1) Try small amount first (e.g., 1 LP token) 2) Gradually increase if successful 3) Consider redeploying a more balanced pool'
            };
        } else if (error.message && error.message.includes('execution reverted')) {
            errorMessage = {
                zh: '交易被回滚：可能是池子储备量极不平衡或合约状态异常。建议先测试少量撤出',
                en: 'Transaction reverted: Possibly due to extremely unbalanced pool reserves or contract state. Try small amount first'
            };
        } else if (error.message && error.message.includes('gas')) {
            errorMessage = {
                zh: 'Gas估算失败，网络拥堵请稍后重试',
                en: 'Gas estimation failed, network congestion please try later'
            };
        }
        
        console.log('错误诊断:', {
            错误类型: errorMessage.zh,
            原始错误: error.message,
            错误堆栈: error.stack
        });
        
        showNotification(errorMessage, 'error');
    } finally {
        showLoading(false);
    }
}

// 显示加载状态
function showLoading(show, message = null) {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = overlay.querySelector('p');
    
    if (show) {
        // 根据当前语言设置加载文本
        if (message) {
            loadingText.textContent = message;
        } else {
            // 默认加载文本
            const defaultMessage = currentLanguage === 'zh' ? '处理交易中...' : 'Processing transaction...';
            loadingText.textContent = defaultMessage;
        }
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
    }
}

// 重复的showNotification函数已删除，使用上面的玻璃拟态版本

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
