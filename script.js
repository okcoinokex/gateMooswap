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
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    "function transfer(address recipient, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transferFrom(address sender, address recipient, uint256 amount) returns (bool)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)"
];

// Factory合约ABI
const FACTORY_ABI = [
    "function getPair(address tokenA, address tokenB) view returns (address)",
    "function allPairsLength() view returns (uint256)"
];

// Pair合约ABI
const PAIR_ABI = [
    "function getReserves() view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast)",
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)"
];

// WGT合约ABI (包含包装和解包功能)
const WGT_ABI = [
    ...ERC20_ABI,
    "function deposit() payable",
    "function withdraw(uint256 wad)"
];

// Router ABI
const ROUTER_ABI = [
    "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[] amounts)",
    "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)",
    "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)",
    "function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity)",
    "function addLiquidityETH(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity)",
    "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)",
    "function removeLiquidity(address tokenA, address tokenB, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256 amountA, uint256 amountB)",
    "function removeLiquidityETH(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) returns (uint256 amountToken, uint256 amountETH)"
];

// 全局变量
let provider;
let signer;
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

// 检查代币授权额度
async function checkTokenAllowance(tokenAddress, spenderAddress, amount) {
    try {
        if (!provider || !signer || !userAccount) {
            console.log('Provider或用户账户未连接');
            return false;
        }
        if (tokenAddress === '0x0000000000000000000000000000000000000000') {
            console.log('GT代币不需要授权');
            return true;
        }

        console.log('检查授权额度:', {
            tokenAddress: tokenAddress,
            spenderAddress: spenderAddress,
            ownerAddress: userAccount,
            requiredAmount: amount
        });
        
        // 创建ERC20合约实例
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        
        // 调用allowance方法
        const allowance = await tokenContract.allowance(userAccount, spenderAddress);
        
        // 确保amount是BigNumber格式
        let amountBN;
        if (typeof amount === 'string' && amount.includes('.')) {
            // 如果是小数，先转换为Wei
            amountBN = ethers.utils.parseEther(amount);
        } else if (typeof amount === 'number') {
            // 如果是数字，先转换为字符串再转Wei
            amountBN = ethers.utils.parseEther(amount.toString());
        } else {
            // 如果已经是Wei字符串，直接使用
            amountBN = ethers.BigNumber.from(amount);
        }
        
        // 比较授权额度
        const hasEnoughAllowance = allowance.gte(amountBN);
        
        console.log('授权额度检查结果:', {
            currentAllowance: allowance.toString(),
            requiredAmount: amountBN.toString(),
            hasEnoughAllowance: hasEnoughAllowance
        });

        return hasEnoughAllowance;
    } catch (error) {
        console.error('检查授权额度失败:', error);
        return false;
    }
}

// 授权代币（最大授权）
async function approveToken(tokenAddress, spenderAddress, amount) {
    try {
        if (!provider || !signer || !userAccount) throw new Error('Provider或用户账户未连接');

        // 修复：处理不同类型的amount输入
        let amountWei;
        
        // 如果amount已经是Wei格式的字符串或BigNumber
        if (ethers.BigNumber.isBigNumber(amount)) {
            amountWei = amount;
        } else if (typeof amount === 'string' && !amount.includes('.') && !amount.includes('e')) {
            // 如果是纯数字字符串（Wei格式）
            amountWei = ethers.BigNumber.from(amount);
        } else {
            // 如果是带小数的数字或科学记数法，需要转换
            let amountStr;
            if (typeof amount === 'number') {
                // 避免科学记数法
                amountStr = amount.toFixed(0);
            } else if (typeof amount === 'string' && amount.includes('e')) {
                // 处理科学记数法
                const num = parseFloat(amount);
                amountStr = Math.floor(num).toString();
            } else {
                amountStr = amount.toString();
            }
            
            // 如果包含小数点，只取整数部分
            if (amountStr.includes('.')) {
                amountStr = amountStr.split('.')[0];
            }
            
            // 使用parseUnits而不是parseEther，避免精度问题
            const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
            const decimals = await tokenContract.decimals();
            amountWei = ethers.utils.parseUnits(amountStr, decimals);
        }
        
        const approvalMessage = currentLanguage === 'zh' ? '正在授权代币...' : 'Approving token...';
        showLoading(true, approvalMessage);
        showNotification(approvalMessage, 'info');

        console.log('授权参数:', {
            from: userAccount,
            to: tokenAddress,
            spender: spenderAddress,
            amount: amountWei.toString()
        });

        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        
        // 发送授权交易
        const tx = await tokenContract.approve(spenderAddress, amountWei, {
            gasLimit: 100000
        });

        console.log('授权交易已发送:', tx.hash);
        
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log('授权交易成功');
            const successMessage = currentLanguage === 'zh' ? '代币授权成功！' : 'Token approved successfully!';
            showNotification(successMessage, 'success');
            return true;
        } else {
            throw new Error('交易失败');
        }

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

// 授权代币
async function approveToken(tokenAddress, spenderAddress, amount) {
    try {
        if (!provider || !signer || !userAccount) throw new Error('Provider或用户账户未连接');

        // 确保amount是字符串格式
        let amountStr;
        if (typeof amount === 'number') {
            amountStr = Math.floor(amount).toString();
        } else if (typeof amount === 'string') {
            const amountNum = parseFloat(amount);
            amountStr = Math.floor(amountNum).toString();
        } else {
            amountStr = amount.toString();
        }
        
        const amountWei = ethers.utils.parseEther(amountStr);
        const approvalMessage = currentLanguage === 'zh' ? '正在授权代币...' : 'Approving token...';
        showLoading(true, approvalMessage);
        showNotification(approvalMessage, 'info');

        console.log('授权参数:', {
            from: userAccount,
            to: tokenAddress,
            spender: spenderAddress,
            amount: amountWei.toString()
        });

        // 创建ERC20合约实例（使用signer进行交易）
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        
        // 发送授权交易
        const tx = await tokenContract.approve(spenderAddress, amountWei, {
            gasLimit: 100000
        });

        console.log('授权交易已发送:', tx.hash);
        
        // 等待交易确认
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log('授权交易成功');
            const successMessage = currentLanguage === 'zh' ? '代币授权成功！' : 'Token approved successfully!';
            showNotification(successMessage, 'success');
            return true;
        } else {
            throw new Error('交易失败');
        }

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

// 显示双语通知
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
    
    // Neumorphic风格样式
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

// 全局错误处理
window.addEventListener('error', function(e) {
    console.error('全局JavaScript错误:', e.error);
    console.error('错误文件:', e.filename);
    console.error('错误行号:', e.lineno);
    console.error('错误列号:', e.colno);
});

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM已加载，开始初始化应用...');
    try {
        initializeApp();
        console.log('应用初始化完成');
    } catch (error) {
        console.error('应用初始化失败:', error);
    }
});

async function initializeApp() {
    // 先设置事件监听器
    setupEventListeners();
    
    // 设置默认代币
    setDefaultTokens();
    
    // 初始化滑点显示
    const slippageDisplay = document.getElementById('slippage');
    if (slippageDisplay) {
        slippageDisplay.textContent = slippage + '%';
    }
    
    // 更新代币列表
    updateTokenList();
    
    // 最后初始化Provider（这会自动恢复钱包连接）
    await initializeProvider();
    
    // 初始化钱包状态显示
    updateWalletStatus();
}
// 当用户切换回页面时更新余额
document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && userAccount && provider) {
        console.log('页面重新可见，更新余额');
        await updateAllBalances();
    }
});
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
    
    console.log('默认代币设置完成');
}

// 设置事件监听器
function setupEventListeners() {
    // 导航按钮
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.currentTarget.dataset.tab;
            console.log('点击了导航按钮:', tab);
            switchTab(tab);
            closeMobileMenu();
        });
    });

    // 移动端菜单按钮
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }

    // 语言切换按钮
    const languageBtn = document.getElementById('languageBtn');
    if (languageBtn) {
        languageBtn.addEventListener('click', (e) => {
            console.log('语言切换按钮被点击了！');
            toggleLanguage();
        });
    }

    // 连接钱包按钮
    const connectWalletBtn = document.getElementById('connectWallet');
    if (connectWalletBtn) {
        connectWalletBtn.addEventListener('click', (e) => {
            console.log('连接钱包按钮被点击了！');
            e.preventDefault();
            e.stopPropagation();
            connectWallet();
        });
    }
    
    // 网络切换按钮
    document.getElementById('networkBtn').addEventListener('click', async () => {
        await switchNetwork();
        setTimeout(() => {
            checkNetworkStatus();
        }, 1000);
    });

    // 代币选择按钮
    document.getElementById('fromTokenSelect').addEventListener('click', () => {
        openTokenModal('from');
    });
    document.getElementById('toTokenSelect').addEventListener('click', () => {
        openTokenModal('to');
    });
    document.getElementById('liquidityATokenSelect').addEventListener('click', () => {
        openTokenModal('liquidityA');
    });
    document.getElementById('liquidityBTokenSelect').addEventListener('click', () => {
        openTokenModal('liquidityB');
    });
    
    // 搜索流动性池的代币选择器
    document.getElementById('searchTokenASelect').addEventListener('click', () => {
        openTokenModal('searchTokenA');
    });
    document.getElementById('searchTokenBSelect').addEventListener('click', () => {
        openTokenModal('searchTokenB');
    });

    // 关闭模态框
    document.getElementById('closeTokenModal').addEventListener('click', closeTokenModal);
    document.getElementById('closeSettingsModal').addEventListener('click', closeSettingsModal);

    // 设置按钮
    document.getElementById('swapSettings').addEventListener('click', () => {
        document.getElementById('swap_toggle').checked = true;
    });
    document.getElementById('liquiditySettings').addEventListener('click', () => openSettingsModal('liquidity'));

    // 滑点选择
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('slippage-btn')) {
            e.preventDefault();
            e.stopPropagation();

            const container = e.target.closest('.slippage-options');
            if (container) {
                const containerButtons = container.querySelectorAll('.slippage-btn');
                containerButtons.forEach(b => {
                    b.classList.remove('active');
                });
            }

            e.target.classList.add('active');

            const slippageValue = parseFloat(e.target.dataset.slippage);
            const slippageDisplay = document.getElementById('slippage');
            if (slippageDisplay) {
                slippageDisplay.textContent = slippageValue + '%';
            }

            slippage = parseFloat(e.target.dataset.slippage);

            showNotification({
                zh: `滑点已设置为 ${slippage}%`,
                en: `Slippage set to ${slippage}%`
            }, 'success');
        }
    });

    // 截止时间输入
    document.getElementById('deadline').addEventListener('input', (e) => {
        deadline = parseInt(e.target.value);
        console.log('截止时间设置已自动保存:', deadline + '分钟');
    });

    document.getElementById('modalDeadline').addEventListener('input', (e) => {
        deadline = parseInt(e.target.value);
        console.log('截止时间设置已自动保存:', deadline + '分钟');
    });

    // 交换按钮
    document.getElementById('swapTokensBtn').addEventListener('click', swapTokens);
    document.getElementById('swapActionBtn').addEventListener('click', executeSwap);

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
    
    // 百分比选择器
    document.querySelectorAll('#lpTokenAmount').forEach(lpInput => {
        const percentageSelector = lpInput.parentElement.querySelector('.percentage-selector');
        if (percentageSelector) {
            percentageSelector.querySelectorAll('.percentage-btn').forEach(btn => {
                btn.addEventListener('click', handlePercentageSelect);
            });
        }
    });

    // 为Swap界面的百分比按钮添加处理
    const swapPercentageBtns = document.querySelectorAll('.percentage-selector .percentage-btn');
    swapPercentageBtns.forEach(btn => {
        btn.addEventListener('click', handleSwapPercentageSelect);
    });

    // 代币搜索
    const tokenSearchInput = document.getElementById('tokenSearch');
    if (tokenSearchInput) {
        const handleInput = (e) => {
            const value = e.target.value;
            const cleanedValue = value.replace(/\s+/g, '');
            if (value !== cleanedValue) {
                e.target.value = cleanedValue;
            }
            handleTokenSearch();
        };
        
        tokenSearchInput.addEventListener('input', debounce(handleInput, 100));
        
        tokenSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleTokenSearch();
            }
        });
        
        tokenSearchInput.addEventListener('paste', (e) => {
            setTimeout(() => {
                handleTokenSearch();
            }, 50);
        });
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

// 初始化Provider - 直接使用注入的钱包
// 替换原来的 initializeProvider 函数
async function initializeProvider() {
    if (window.ethereum) {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        console.log('钱包已直接注入，Provider和Signer已初始化');
        
        // 设置事件监听器
        window.ethereum.on('accountsChanged', async (accounts) => {
            if (accounts.length === 0) {
                userAccount = null;
                updateWalletStatus();
                // 清空余额
                document.querySelectorAll('.balance').forEach(el => {
                    el.textContent = currentLanguage === 'zh' ? '余额: 0' : 'Balance: 0';
                });
            } else {
                userAccount = accounts[0];
                updateWalletStatus();
                // 更新余额
                await updateAllBalances();
            }
        });
        
        window.ethereum.on('chainChanged', (chainId) => {
            window.location.reload();
        });
        
        // 关键修改：自动恢复连接
        try {
            // 先检查是否已经授权
            const accounts = await window.ethereum.request({ 
                method: 'eth_accounts' 
            });
            
            if (accounts.length > 0) {
                // 如果已经授权，直接设置账户
                userAccount = accounts[0];
                console.log('检测到已授权钱包，自动恢复连接:', userAccount);
                
                // 更新钱包状态
                updateWalletStatus();
                
                // 延迟更新余额，确保DOM已加载
                setTimeout(async () => {
                    // 设置默认代币
                    const defaultFromToken = {
                        address: '0x0000000000000000000000000000000000000000',
                        symbol: 'GT',
                        name: 'Gate Token',
                        decimals: 18,
                        icon: 'gt-logo.png'
                    };
                    
                    // 更新余额
                    await updateBalance('fromBalance', defaultFromToken);
                    await updateBalance('liquidityABalance', defaultFromToken);
                    
                    // 如果有选中的代币，更新它们的余额
                    await updateAllBalances();
                }, 500);
            } else {
                console.log('钱包未连接，等待用户手动连接');
            }
        } catch (error) {
            console.log('获取账户失败，等待用户手动连接:', error);
        }
    } else {
        console.log('未检测到钱包，等待用户安装');
    }
}

// 连接钱包
// 在 script.js 中找到 connectWallet 函数，修改为：
async function connectWallet() {
    if (!window.ethereum) {
        showNotification({
            zh: '请安装MetaMask或其他Web3钱包',
            en: 'Please install MetaMask or other Web3 wallet'
        }, 'error');
        return;
    }

    try {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAccount = await signer.getAddress();
        
        updateWalletStatus();
        
        showNotification({
            zh: '钱包连接成功',
            en: 'Wallet connected successfully'
        }, 'success');
        
        // 立即更新所有余额
        await updateAllBalances();
        
        // 然后再切换网络
        await autoSwitchToGateLayer();
        
    } catch (error) {
        console.error('连接钱包失败:', error);
        showNotification({
            zh: '连接钱包失败',
            en: 'Failed to connect wallet'
        }, 'error');
    }
}

// 添加这个新函数
async function updateAllBalances() {
    if (!userAccount || !provider) {
        console.log('钱包未连接，跳过余额更新');
        return;
    }
    
    console.log('开始更新所有余额...');
    
    // 获取当前选中的代币信息
    const fromSelect = document.getElementById('fromTokenSelect');
    const toSelect = document.getElementById('toTokenSelect');
    const liquidityASelect = document.getElementById('liquidityATokenSelect');
    const liquidityBSelect = document.getElementById('liquidityBTokenSelect');
    
    // 更新From代币余额
    if (fromSelect && fromSelect.dataset.token) {
        const fromToken = JSON.parse(fromSelect.dataset.token);
        await updateBalance('fromBalance', fromToken);
    }
    
    // 更新To代币余额
    if (toSelect && toSelect.dataset.token) {
        const toToken = JSON.parse(toSelect.dataset.token);
        await updateBalance('toBalance', toToken);
    }
    
    // 更新Liquidity A代币余额
    if (liquidityASelect && liquidityASelect.dataset.token) {
        const liquidityAToken = JSON.parse(liquidityASelect.dataset.token);
        await updateBalance('liquidityABalance', liquidityAToken);
    }
    
    // 更新Liquidity B代币余额
    if (liquidityBSelect && liquidityBSelect.dataset.token) {
        const liquidityBToken = JSON.parse(liquidityBSelect.dataset.token);
        await updateBalance('liquidityBBalance', liquidityBToken);
    }
    
    console.log('所有余额更新完成');
}

// 更新钱包状态
function updateWalletStatus() {
    const connectBtn = document.getElementById('connectWallet');
    const swapBtn = document.getElementById('swapActionBtn');
    const currentLang = document.getElementById('languageText').textContent;
    const connectText = currentLang === '中文' ? '连接钱包' : 'Connect Wallet';
    const swapText = currentLang === '中文' ? '交换' : 'Swap';
    
    if (userAccount) {
        const walletName = currentWallet ? currentWallet.name : 'Wallet';
        const shortAddress = `${userAccount.slice(0, 6)}...${userAccount.slice(-4)}`;
        connectBtn.innerHTML = `<i class="fas fa-wallet"></i> <span class="btn-text">${walletName}: ${shortAddress}</span>`;
        connectBtn.style.background = 'rgba(16, 185, 129, 0.2)';
        connectBtn.style.borderColor = '#10b981';
        connectBtn.querySelector('i').style.color = '#10b981';
        
        connectBtn.onclick = disconnectWallet;
        
        if (swapBtn) {
            swapBtn.innerHTML = `<i class="fas fa-exchange-alt"></i> ${swapText}`;
        }
    } else {
        connectBtn.innerHTML = `<i class="fas fa-wallet"></i> <span class="btn-text">${connectText}</span>`;
        connectBtn.style.background = 'rgba(33, 33, 33, 0.6)';
        connectBtn.style.borderColor = '#212121';
        connectBtn.querySelector('i').style.color = '#22c55e';
        
        if (swapBtn) {
            swapBtn.innerHTML = `<i class="fas fa-wallet"></i> ${connectText}`;
        }
    }
}

// 断开钱包连接
function disconnectWallet() {
    userAccount = null;
    currentWallet = null;
    provider = null;
    signer = null;
    updateWalletStatus();
    
    const connectBtn = document.getElementById('connectWallet');
    connectBtn.onclick = connectWallet;
    
    showNotification({
        zh: '钱包已断开连接',
        en: 'Wallet disconnected'
    }, 'info');
}

// 自动切换到Gate Layer网络
async function autoSwitchToGateLayer() {
    try {
        if (!provider || !userAccount) {
            console.log('Provider或用户账户未连接，跳过网络切换');
            return;
        }

        const network = await provider.getNetwork();
        const currentChainId = network.chainId;
        console.log('当前网络ID:', currentChainId);

        // 如果已经在Gate Layer网络
        if (currentChainId === 10088) {
            console.log('已在Gate Layer网络');
            return;
        }

        console.log('需要切换到Gate Layer网络');
        
        // 尝试切换网络
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: NETWORK_CONFIG.chainId }]
            });
            console.log('成功切换到Gate Layer网络');
            
            showNotification({
                zh: '已自动切换到Gate Layer网络',
                en: 'Automatically switched to Gate Layer network'
            }, 'success');
        } catch (switchError) {
            // 如果网络不存在，尝试添加
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [NETWORK_CONFIG]
                    });
                    console.log('Gate Layer网络添加成功');
                } catch (addError) {
                    console.log('添加网络失败:', addError.message);
                }
            }
        }
    } catch (error) {
        console.error('自动网络切换失败:', error);
        showNotification({
            zh: '网络切换失败，请手动切换到Gate Layer',
            en: 'Network switch failed, please manually switch to Gate Layer'
        }, 'warning');
    }
}

// 切换网络
async function switchNetwork() {
    if (!window.ethereum) {
        showNotification({
            zh: '请安装MetaMask',
            en: 'Please install MetaMask'
        }, 'info');
        return;
    }
    
    try {
        if (!provider) {
            provider = new ethers.providers.Web3Provider(window.ethereum);
        }
        
        const network = await provider.getNetwork();
        const currentChainId = network.chainId;
        console.log('当前网络ID:', currentChainId);
        
        if (currentChainId === 10088) {
            showNotification({
                zh: '已连接到Gate Layer网络',
                en: 'Already connected to Gate Layer network'
            }, 'info');
            return;
        }
        
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: NETWORK_CONFIG.chainId }],
        });
        
        showNotification({
            zh: '已成功切换到Gate Layer网络',
            en: 'Successfully switched to Gate Layer network'
        }, 'success');
        
    } catch (switchError) {
        console.error('切换网络失败:', switchError);
        
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [NETWORK_CONFIG],
                });
                
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
    if (!window.ethereum || !provider) {
        console.log('MetaMask未安装或Provider未初始化');
        return;
    }
    
    try {
        const network = await provider.getNetwork();
        const chainId = network.chainId;
        const networkName = document.getElementById('networkName');
        
        console.log('当前网络ID:', chainId);
        
        if (chainId === 10088) {
            networkName.textContent = 'Gate Layer';
            networkName.style.color = '#10b981';
        } else {
            networkName.textContent = `Network ${chainId}`;
            networkName.style.color = '#60a5fa';
        }
    } catch (error) {
        console.error('检查网络状态失败:', error);
    }
}

// 后续函数保持不变，但所有web3.js相关的调用都需要转换为ethers.js
// 由于字符限制，我只展示了主要的转换部分
// 其余函数需要将所有web3相关调用替换为ethers等价调用

// 例如：
// web3.eth.getBalance(address) -> provider.getBalance(address)
// web3.utils.toWei(amount, 'ether') -> ethers.utils.parseEther(amount)
// web3.utils.fromWei(amount, 'ether') -> ethers.utils.formatEther(amount)
// new web3.eth.Contract(abi, address) -> new ethers.Contract(address, abi, provider)
// contract.methods.functionName().call() -> contract.functionName()
// contract.methods.functionName().send({from: account}) -> contract.connect(signer).functionName()

// 更新余额
async function updateBalance(balanceId, tokenInfo) {
    const balanceElement = document.getElementById(balanceId);
    if (!balanceElement) return;
    
    // 立即显示加载中状态
    const loadingText = currentLanguage === 'zh' ? '余额: 加载中...' : 'Balance: Loading...';
    balanceElement.textContent = loadingText;
    
    if (!userAccount || !provider) {
        const balanceText = currentLanguage === 'zh' ? '余额: 0' : 'Balance: 0';
        balanceElement.textContent = balanceText;
        return;
    }
    
    try {
        let balance;
        if (tokenInfo.address === '0x0000000000000000000000000000000000000000') {
            // GT余额 - 原生代币
            console.log('获取GT余额...');
            const balanceBN = await provider.getBalance(userAccount);
            balance = ethers.utils.formatEther(balanceBN);
            console.log('GT余额:', balance);
        } else {
            // ERC20代币余额
            console.log(`获取${tokenInfo.symbol}余额...`);
            const tokenContract = new ethers.Contract(tokenInfo.address, ERC20_ABI, provider);
            const balanceBN = await tokenContract.balanceOf(userAccount);
            balance = ethers.utils.formatUnits(balanceBN, tokenInfo.decimals);
            console.log(`${tokenInfo.symbol}余额:`, balance);
        }
        
        const balanceNum = parseFloat(balance);
        const balancePrefix = currentLanguage === 'zh' ? '余额: ' : 'Balance: ';
        
        // 立即更新显示
        if (balanceNum === 0) {
            balanceElement.textContent = balancePrefix + '0';
        } else if (balanceNum < 0.000001) {
            balanceElement.textContent = balancePrefix + '< 0.000001';
        } else if (balanceNum < 1) {
            balanceElement.textContent = balancePrefix + balanceNum.toFixed(6);
        } else if (balanceNum < 1000) {
            balanceElement.textContent = balancePrefix + balanceNum.toFixed(4);
        } else {
            balanceElement.textContent = balancePrefix + balanceNum.toFixed(2);
        }
        
    } catch (error) {
        console.error('获取余额失败:', error);
        const errorText = currentLanguage === 'zh' ? '余额: 获取失败' : 'Balance: Failed';
        balanceElement.textContent = errorText;
    }
}

// 计算交换输出（转换为ethers.js）
async function calculateSwapOutput() {
    const fromAmount = document.getElementById('fromAmount').value;
    const fromSelect = document.getElementById('fromTokenSelect');
    const toSelect = document.getElementById('toTokenSelect');
    
    if (!toSelect.dataset.token) {
        document.getElementById('toAmountDisplay').textContent = currentLanguage === 'zh' ? '请选择代币' : 'Select Token';
        return;
    }
    
    if (!fromAmount || !fromSelect.dataset.token) {
        document.getElementById('toAmountDisplay').textContent = '0.0';
        return;
    }
    
    const fromToken = JSON.parse(fromSelect.dataset.token);
    const toToken = JSON.parse(toSelect.dataset.token);
    
    if (fromToken.address === toToken.address) {
        document.getElementById('toAmountDisplay').textContent = fromAmount;
        return;
    }
    
    // GT和WGT之间1:1转换
    if ((fromToken.symbol === 'GT' && toToken.symbol === 'WGT') || 
        (fromToken.symbol === 'WGT' && toToken.symbol === 'GT')) {
        document.getElementById('toAmountDisplay').textContent = fromAmount;
        document.getElementById('currentPrice').textContent = `1 ${fromToken.symbol} = 1.0 ${toToken.symbol}`;
        return;
    }
    
    try {
        if (!provider) {
            document.getElementById('toAmountDisplay').textContent = '0.0';
            return;
        }
        
        const router = new ethers.Contract(CONTRACT_ADDRESSES.router, ROUTER_ABI, provider);
        
        // 构建交换路径
        let path;
        if (fromToken.address === '0x0000000000000000000000000000000000000000') {
            path = [CONTRACT_ADDRESSES.WGT, toToken.address];
        } else if (toToken.address === '0x0000000000000000000000000000000000000000') {
            path = [fromToken.address, CONTRACT_ADDRESSES.WGT];
        } else {
            // Token to Token
            if (fromToken.address === CONTRACT_ADDRESSES.WGT || toToken.address === CONTRACT_ADDRESSES.WGT) {
                path = [fromToken.address, toToken.address];
            } else {
                path = [fromToken.address, CONTRACT_ADDRESSES.WGT, toToken.address];
            }
        }
        
        const amountIn = ethers.utils.parseUnits(fromAmount, fromToken.decimals);
        
        try {
            const amounts = await router.getAmountsOut(amountIn, path);
            const amountOut = ethers.utils.formatUnits(amounts[amounts.length - 1], toToken.decimals);
            
            const outputAmount = parseFloat(amountOut).toFixed(2);
            document.getElementById('toAmountDisplay').textContent = outputAmount;
            
            const price = parseFloat(amountOut) / parseFloat(fromAmount);
            document.getElementById('currentPrice').textContent = `1 ${fromToken.symbol} = ${price.toFixed(6)} ${toToken.symbol}`;
        } catch (routerError) {
            console.log('Router计算失败，显示估算值:', routerError.message);
            const estimatedOutput = (parseFloat(fromAmount) * 0.95).toFixed(2);
            document.getElementById('toAmountDisplay').textContent = estimatedOutput;
            document.getElementById('currentPrice').textContent = `1 ${fromToken.symbol} ≈ 0.95 ${toToken.symbol} (估算)`;
        }
        
    } catch (error) {
        console.error('计算价格失败:', error);
        document.getElementById('toAmountDisplay').textContent = '计算失败';
        document.getElementById('currentPrice').textContent = '价格计算失败';
    }
}

// 切换标签页
function switchTab(tab) {
    console.log('切换到标签页:', tab);
    
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
    
    if (targetTab) {
        targetTab.classList.add('active');
        
        // 如果切换到流动性页面，刷新按钮状态
        if (tab === 'liquidity') {
            setTimeout(() => {
                checkLiquidityForm();
                forceRefreshLiquidityButton();
            }, 100);
        }
    }

    currentTab = tab;
}

// 切换移动端菜单
function toggleMobileMenu() {
    const navMenu = document.getElementById('navMenu');
    const navActions = document.getElementById('navActions');
    
    const isOpen = navMenu.classList.contains('active');
    
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
    
    navMenu.classList.add('active');
    navActions.classList.add('active');
    mobileMenuBtn.innerHTML = '<i class="fas fa-times"></i>';
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
    
    document.getElementById('languageText').textContent = newLang;
    currentLanguage = newLang === '中文' ? 'zh' : 'en';
    
    updateNavigationText(newLang);
    closeMobileMenu();
}

// 更新导航栏文本
function updateNavigationText(lang) {
    const navTexts = document.querySelectorAll('.nav-text');
    const connectWalletText = document.querySelector('.btn-text');
    
    if (lang === '中文') {
        navTexts[0].textContent = '交换';
        navTexts[1].textContent = '流动性';
        if (!userAccount) {
            connectWalletText.textContent = '连接钱包';
        }
        updateGlobalLanguage('zh');
    } else {
        navTexts[0].textContent = 'Swap';
        navTexts[1].textContent = 'Liquidity';
        if (!userAccount) {
            connectWalletText.textContent = 'Connect Wallet';
        }
        updateGlobalLanguage('en');
    }
    
    updateWalletStatus();
}

// 全局语言切换函数
function updateGlobalLanguage(lang) {
    currentLanguage = lang;
    updateSwapInterfaceText(lang);
    updateLiquidityInterfaceText(lang);
    updateModalText(lang);
    updateAlertText(lang);
}

// 更新Swap界面文本
function updateSwapInterfaceText(lang) {
    const formDetails = document.querySelector('.form_details');
    if (formDetails) {
        formDetails.textContent = lang === 'zh' ? '交换代币' : 'Swap Tokens';
    }
    
    const tokenInputHeaders = document.querySelectorAll('.token-input-header span:first-child');
    
    if (lang === 'zh') {
        tokenInputHeaders.forEach((label, index) => {
            if (index === 0) label.textContent = '从';
            if (index === 1) label.textContent = '到';
        });
        
        const balanceLabels = document.querySelectorAll('.balance');
        balanceLabels.forEach(label => {
            if (label.textContent.includes('Balance:')) {
                label.textContent = label.textContent.replace('Balance:', '余额:');
            }
        });
    } else {
        tokenInputHeaders.forEach((label, index) => {
            if (index === 0) label.textContent = 'From';
            if (index === 1) label.textContent = 'To';
        });
        
        const balanceLabels = document.querySelectorAll('.balance');
        balanceLabels.forEach(label => {
            if (label.textContent.includes('余额:')) {
                label.textContent = label.textContent.replace('余额:', 'Balance:');
            }
        });
    }
}

// 更新流动性界面文本
function updateLiquidityInterfaceText(lang) {
    const liquidityFormDetails = document.querySelectorAll('.form_details');
    liquidityFormDetails.forEach(detail => {
        if (detail.textContent === '添加流动性' || detail.textContent === 'Add Liquidity') {
            detail.textContent = lang === 'zh' ? '添加流动性' : 'Add Liquidity';
        } else if (detail.textContent === '撤出流动性' || detail.textContent === 'Remove Liquidity') {
            detail.textContent = lang === 'zh' ? '撤出流动性' : 'Remove Liquidity';
        }
    });
}

// 更新模态框文本
function updateModalText(lang) {
    const tokenModalTitle = document.querySelector('#tokenModal .modal-header h3');
    if (tokenModalTitle) {
        tokenModalTitle.textContent = lang === 'zh' ? '选择代币' : 'Select Token';
    }
}

// 更新警告和提示文本
function updateAlertText(lang) {
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
}

// 打开代币选择模态框
function openTokenModal(type) {
    console.log('打开代币选择模态框，类型:', type);
    selectedTokenType = type;
    const modal = document.getElementById('tokenModal');
    modal.classList.add('active');
    document.getElementById('tokenSearch').focus();
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
        
        tokenItem.addEventListener('click', (e) => {
            e.stopPropagation();
            selectToken(tokenItem);
        });
        
        tokenList.appendChild(tokenItem);
    });
}

// 选择代币
function selectToken(token) {
    let tokenInfo;
    
    if (token.dataset) {
        tokenInfo = {
            address: token.dataset.address,
            symbol: token.dataset.symbol,
            decimals: parseInt(token.dataset.decimals),
            name: token.dataset.name,
            icon: token.dataset.icon
        };
    } else {
        tokenInfo = token;
    }
    
    console.log('选择代币:', tokenInfo, '类型:', selectedTokenType);
    
    // 验证代币信息
    if (!tokenInfo.address || tokenInfo.address === 'undefined') {
        showNotification({
            zh: '代币地址无效，请重新选择',
            en: 'Invalid token address, please reselect'
        }, 'error');
        return;
    }
    
    // 更新显示
    if (selectedTokenType === 'from') {
        updateTokenDisplay('fromTokenSelect', tokenInfo);
        // 立即更新余额，不等待
        updateBalance('fromBalance', tokenInfo);
    } else if (selectedTokenType === 'to') {
        updateTokenDisplay('toTokenSelect', tokenInfo);
        // 立即更新余额
        updateBalance('toBalance', tokenInfo);
        calculateSwapOutput();
    }else if (selectedTokenType === 'liquidityA') {
        updateTokenDisplay('liquidityATokenSelect', tokenInfo);
        updateBalance('liquidityABalance', tokenInfo);
        checkLiquidityForm();
    } else if (selectedTokenType === 'liquidityB') {
        updateTokenDisplay('liquidityBTokenSelect', tokenInfo);
        updateBalance('liquidityBBalance', tokenInfo);
        checkLiquidityForm();
    } else if (selectedTokenType === 'searchTokenA') {
        updateTokenDisplay('searchTokenASelect', tokenInfo);
    } else if (selectedTokenType === 'searchTokenB') {
        updateTokenDisplay('searchTokenBSelect', tokenInfo);
    }
    
    closeTokenModal();
}

// 在 initializeProvider 函数中，修改账户切换监听器：
window.ethereum.on('accountsChanged', async (accounts) => {
    if (accounts.length === 0) {
        userAccount = null;
        updateWalletStatus();
        // 清空余额显示
        document.querySelectorAll('.balance').forEach(el => {
            el.textContent = currentLanguage === 'zh' ? '余额: 0' : 'Balance: 0';
        });
    } else {
        userAccount = accounts[0];
        updateWalletStatus();
        // 账户切换后立即更新所有余额
        await updateAllBalances();
    }
});                                                                                                                             


// 如果需要定期刷新余额，可以添加：
let balanceRefreshInterval;

function startBalanceRefresh() {
    // 每10秒刷新一次余额
    balanceRefreshInterval = setInterval(() => {
        if (userAccount && provider) {
            updateAllBalances();
        }
    }, 10000);
}

function stopBalanceRefresh() {
    if (balanceRefreshInterval) {
        clearInterval(balanceRefreshInterval);
    }
}

// 在连接钱包后启动
// 在 connectWallet 成功后调用 startBalanceRefresh()
// 在 disconnectWallet 时调用 stopBalanceRefresh()
// 更新代币显示
function updateTokenDisplay(selectId, tokenInfo) {
    const select = document.getElementById(selectId);
    const tokenInfoDiv = select.querySelector('.token-info');
    
    if (tokenInfo) {
        tokenInfoDiv.innerHTML = `
            <img src="${tokenInfo.icon}" alt="${tokenInfo.symbol}" class="token-icon">
            <span class="token-symbol">${tokenInfo.symbol}</span>
            <i class="fas fa-chevron-down"></i>
        `;
        tokenInfoDiv.classList.add('has-token');
        tokenInfoDiv.classList.remove('select-token-btn');
        
        select.dataset.token = JSON.stringify(tokenInfo);
    } else {
        const selectTokenText = currentLanguage === 'en' ? 'Select Token' : '选择代币';
        tokenInfoDiv.innerHTML = `
            <span class="select-token-text">${selectTokenText}</span>
            <i class="fas fa-chevron-down"></i>
        `;
        tokenInfoDiv.classList.add('select-token-btn');
        tokenInfoDiv.classList.remove('has-token');
        
        delete select.dataset.token;
    }
}

// 处理代币搜索
async function handleTokenSearch() {
    const searchInput = document.getElementById('tokenSearch');
    const searchTerm = searchInput.value.trim().replace(/\s+/g, '');
    const tokenList = document.getElementById('tokenList');
    
    if (searchTerm.length === 0) {
        updateTokenList();
        return;
    }
    
    // 检查是否是合约地址
    if (searchTerm.startsWith('0x') && searchTerm.length === 42) {
        tokenList.innerHTML = `<div class="searching">⏳ 搜索中...</div>`;
        searchTokenByAddress(searchTerm);
    } else {
        updateTokenList();
    }
}

// 通过合约地址搜索代币
async function searchTokenByAddress(address) {
    const tokenList = document.getElementById('tokenList');
    
    if (!provider) {
        if (window.ethereum) {
            provider = new ethers.providers.Web3Provider(window.ethereum);
        } else {
            tokenList.innerHTML = `<div class="error">❌ 请连接钱包</div>`;
            return;
        }
    }
    
    try {
        tokenList.innerHTML = `<div class="searching">🔍 检查合约...</div>`;
        
        // 检查合约是否存在
        const code = await provider.getCode(address);
        
        if (code === '0x') {
            tokenList.innerHTML = `<div class="error">❌ 无效的合约地址</div>`;
            return;
        }
        
        tokenList.innerHTML = `<div class="searching">📋 获取代币信息...</div>`;
        
        // 创建代币合约实例
        const tokenContract = new ethers.Contract(address, ERC20_ABI, provider);
        
        // 获取代币信息
        let tokenName = 'Unknown Token';
        let tokenSymbol = 'UNKNOWN';
        let tokenDecimals = 18;
        
        try {
            tokenName = await tokenContract.name();
        } catch (error) {
            console.warn('获取代币名称失败:', error.message);
        }
        
        try {
            tokenSymbol = await tokenContract.symbol();
        } catch (error) {
            console.warn('获取代币符号失败:', error.message);
        }
        
        try {
            tokenDecimals = await tokenContract.decimals();
        } catch (error) {
            console.warn('获取代币精度失败:', error.message);
        }
        
        const token = {
            address: address,
            symbol: tokenSymbol,
            name: tokenName,
            decimals: tokenDecimals,
            icon: 'gt-logo.png'
        };
        
        displaySearchResult(token);
        
    } catch (error) {
        console.error('搜索代币失败:', error);
        tokenList.innerHTML = `<div class="error">❌ 搜索失败: ${error.message}</div>`;
    }
}

// 显示搜索结果
function displaySearchResult(token) {
    const tokenList = document.getElementById('tokenList');
    tokenList.innerHTML = '';
    
    const resultTitle = document.createElement('div');
    resultTitle.className = 'search-result-title';
    resultTitle.innerHTML = `<span>🔍 搜索结果</span>`;
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
    `;
    
    tokenItem.addEventListener('click', (e) => {
        e.stopPropagation();
        selectToken(tokenItem);
    });
    
    tokenList.appendChild(tokenItem);
}

// 交换代币位置
function swapTokens() {
    const fromSelect = document.getElementById('fromTokenSelect');
    const toSelect = document.getElementById('toTokenSelect');
    const fromAmount = document.getElementById('fromAmount');
    const toAmountDisplay = document.getElementById('toAmountDisplay');
    
    const fromToken = fromSelect.dataset.token;
    const toToken = toSelect.dataset.token;
    
    if (fromToken && toToken) {
        const fromTokenInfo = JSON.parse(fromToken);
        const toTokenInfo = JSON.parse(toToken);
        
        if (fromTokenInfo.symbol === toTokenInfo.symbol) {
            showNotification({
                zh: '不能交换相同的代币',
                en: 'Cannot swap the same token'
            }, 'error');
            return;
        }
        
        updateTokenDisplay('fromTokenSelect', toTokenInfo);
        updateTokenDisplay('toTokenSelect', fromTokenInfo);
        updateBalance('fromBalance', toTokenInfo);
        updateBalance('toBalance', fromTokenInfo);
    }
    
    const fromValue = fromAmount.value;
    const toValue = toAmountDisplay.textContent;
    
    fromAmount.value = toValue;
    toAmountDisplay.textContent = fromValue;
    
    if (fromAmount.value) {
        calculateSwapOutput();
    }
}

// 处理金额输入
const handleAmountInput = debounce(function() {
    calculateSwapOutput();
}, 500);

// 处理流动性金额输入
const handleLiquidityAmountInput = debounce(function(event) {
    console.log('流动性金额输入变化:', event.target.id, event.target.value);
    calculateLiquidityAmounts(event.target.id);
    checkLiquidityForm();
    forceRefreshLiquidityButton();
}, 500);

// 计算流动性金额
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
        
        if (tokenAInfo.symbol === tokenBInfo.symbol) {
            return;
        }
        
        const amountAValue = parseFloat(amountA.value) || 0;
        const amountBValue = parseFloat(amountB.value) || 0;
        
        const priceRatio = await getTokenPriceRatio(tokenAInfo, tokenBInfo);
        
        if (priceRatio !== null) {
            console.log(`找到交易对，价格比例: ${priceRatio}`);
            
            if (changedInputId === 'liquidityAAmount' && amountAValue > 0) {
                const calculatedB = amountAValue * priceRatio;
                amountB.value = calculatedB.toFixed(2);
            } else if (changedInputId === 'liquidityBAmount' && amountBValue > 0) {
                const calculatedA = amountBValue / priceRatio;
                amountA.value = calculatedA.toFixed(2);
            }
            
            updateLiquidityPriceDisplay(tokenAInfo, tokenBInfo, priceRatio);
        }
        
    } catch (error) {
        console.error('计算流动性金额失败:', error);
    }
}

// 获取代币价格比例（使用ethers.js）
async function getTokenPriceRatio(tokenA, tokenB) {
    try {
        if (!provider) return null;
        
        let queryTokenA = tokenA;
        let queryTokenB = tokenB;
        
        if (tokenA.address === '0x0000000000000000000000000000000000000000') {
            queryTokenA = { ...tokenA, address: CONTRACT_ADDRESSES.WGT };
        }
        
        if (tokenB.address === '0x0000000000000000000000000000000000000000') {
            queryTokenB = { ...tokenB, address: CONTRACT_ADDRESSES.WGT };
        }
        
        const factory = new ethers.Contract(CONTRACT_ADDRESSES.factory, FACTORY_ABI, provider);
        const pairAddress = await factory.getPair(queryTokenA.address, queryTokenB.address);
        
        if (pairAddress === '0x0000000000000000000000000000000000000000') {
            return null;
        }
        
        const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
        
        const [reserves, token0Address, token1Address] = await Promise.all([
            pairContract.getReserves(),
            pairContract.token0(),
            pairContract.token1()
        ]);
        
        const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, provider);
        const token1Contract = new ethers.Contract(token1Address, ERC20_ABI, provider);
        
        const [token0Decimals, token1Decimals] = await Promise.all([
            token0Contract.decimals(),
            token1Contract.decimals()
        ]);
        
        const reserve0 = parseFloat(ethers.utils.formatUnits(reserves._reserve0, token0Decimals));
        const reserve1 = parseFloat(ethers.utils.formatUnits(reserves._reserve1, token1Decimals));
        
        let priceRatio;
        if (queryTokenA.address.toLowerCase() === token0Address.toLowerCase()) {
            priceRatio = reserve1 / reserve0;
        } else {
            priceRatio = reserve0 / reserve1;
        }
        
        return priceRatio;
        
    } catch (error) {
        console.error('获取价格比例失败:', error);
        return null;
    }
}

// 更新流动性价格显示
function updateLiquidityPriceDisplay(tokenA, tokenB, priceRatio) {
    const priceElement = document.querySelector('.liquidity-price');
    if (priceElement) {
        priceElement.textContent = `1 ${tokenA.symbol} = ${priceRatio.toFixed(6)} ${tokenB.symbol}`;
    }
}

// 搜索流动性池（使用ethers.js）
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

    try {
        if (!provider) return;
        
        let queryTokenA = tokenA;
        let queryTokenB = tokenB;
        
        if (tokenA.address === '0x0000000000000000000000000000000000000000') {
            queryTokenA = { ...tokenA, address: CONTRACT_ADDRESSES.WGT };
        }
        
        if (tokenB.address === '0x0000000000000000000000000000000000000000') {
            queryTokenB = { ...tokenB, address: CONTRACT_ADDRESSES.WGT };
        }

        const factoryContract = new ethers.Contract(CONTRACT_ADDRESSES.factory, FACTORY_ABI, provider);
        const pairAddress = await factoryContract.getPair(queryTokenA.address, queryTokenB.address);

        if (pairAddress === '0x0000000000000000000000000000000000000000') {
            showNotification({
                zh: '交易对不存在',
                en: 'Trading pair does not exist'
            }, 'error');
            document.getElementById('liquidityPoolResult').style.display = 'none';
            return;
        }

        const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);

        const [reserves, totalSupply, token0, token1] = await Promise.all([
            pairContract.getReserves(),
            pairContract.totalSupply(),
            pairContract.token0(),
            pairContract.token1()
        ]);

        const userLPBalance = await getLPBalance(tokenA, tokenB);

        let reserveA, reserveB;
        if (token0.toLowerCase() === queryTokenA.address.toLowerCase()) {
            reserveA = reserves[0];
            reserveB = reserves[1];
        } else {
            reserveA = reserves[1];
            reserveB = reserves[0];
        }

        const tokenAContract = new ethers.Contract(queryTokenA.address, ERC20_ABI, provider);
        const tokenBContract = new ethers.Contract(queryTokenB.address, ERC20_ABI, provider);

        const [decimalsA, decimalsB] = await Promise.all([
            tokenAContract.decimals(),
            tokenBContract.decimals()
        ]);

        const formattedReserveA = ethers.utils.formatUnits(reserveA, decimalsA);
        const formattedReserveB = ethers.utils.formatUnits(reserveB, decimalsB);

        const totalLiquidity = (parseFloat(formattedReserveA) + parseFloat(formattedReserveB)).toFixed(2);

        const totalLP = parseFloat(ethers.utils.formatEther(totalSupply));
        const userSharePercentage = userLPBalance > 0 ? (userLPBalance / totalLP) * 100 : 0;

        document.getElementById('totalLiquidity').textContent = `${totalLiquidity}`;
        document.getElementById('userLPTokens').textContent = `${userLPBalance.toFixed(6)} LP`;
        document.getElementById('userShare').textContent = `${userSharePercentage.toFixed(4)}%`;

        window.currentLiquidityPool = {
            pairAddress,
            tokenA,
            tokenB,
            queryTokenA,
            queryTokenB,
            reserves,
            totalSupply,
            token0,
            token1,
            decimalsA,
            decimalsB
        };

        document.getElementById('liquidityPoolResult').style.display = 'block';

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

// 获取LP代币余额（使用ethers.js）
async function getLPBalance(tokenA, tokenB) {
    try {
        if (!userAccount || !provider) {
            return 0;
        }

        let queryTokenA = tokenA;
        let queryTokenB = tokenB;
        
        if (tokenA.address === '0x0000000000000000000000000000000000000000') {
            queryTokenA = { ...tokenA, address: CONTRACT_ADDRESSES.WGT };
        }
        
        if (tokenB.address === '0x0000000000000000000000000000000000000000') {
            queryTokenB = { ...tokenB, address: CONTRACT_ADDRESSES.WGT };
        }

        const factory = new ethers.Contract(CONTRACT_ADDRESSES.factory, FACTORY_ABI, provider);
        const pairAddress = await factory.getPair(queryTokenA.address, queryTokenB.address);
        
        if (pairAddress === '0x0000000000000000000000000000000000000000') {
            return 0;
        }
        
        const lpContract = new ethers.Contract(pairAddress, ["function balanceOf(address) view returns (uint256)"], provider);
        const balance = await lpContract.balanceOf(userAccount);
        const balanceFloat = parseFloat(ethers.utils.formatEther(balance));
        
        return balanceFloat;
        
    } catch (error) {
        console.error('获取LP代币余额失败:', error);
        return 0;
    }
}

// 处理百分比选择
function handlePercentageSelect(event) {
    const percentage = parseInt(event.target.dataset.percentage);
    
    document.querySelectorAll('.percentage-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    event.target.classList.add('active');
    calculateLPAmount(percentage);
}

// 计算LP代币数量
async function calculateLPAmount(percentage) {
    const lpAmountInput = document.getElementById('lpTokenAmount');
    
    if (!window.currentLiquidityPool) {
        showNotification({
            zh: '请先搜索流动性池',
            en: 'Please search liquidity pool first'
        }, 'warning');
        return;
    }
    
    try {
        const { tokenA, tokenB } = window.currentLiquidityPool;
        const lpBalance = await getLPBalance(tokenA, tokenB);
        
        if (lpBalance > 0) {
            const lpAmount = (lpBalance * percentage) / 100;
            let lpAmountInt = lpAmount - Math.floor(lpAmount) > 0.1 ? Math.ceil(lpAmount) : Math.floor(lpAmount);
            lpAmountInt = Math.max(1, lpAmountInt);
            
            lpAmountInput.value = lpAmountInt.toString();
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

// 计算移除流动性后将收到的代币数量（使用ethers.js）
async function calculateRemoveLiquidityAmounts(tokenA, tokenB, lpAmount) {
    try {
        if (!provider) return;
        
        let queryTokenA = tokenA;
        let queryTokenB = tokenB;
        
        if (tokenA.address === '0x0000000000000000000000000000000000000000') {
            queryTokenA = { ...tokenA, address: CONTRACT_ADDRESSES.WGT };
        }
        
        if (tokenB.address === '0x0000000000000000000000000000000000000000') {
            queryTokenB = { ...tokenB, address: CONTRACT_ADDRESSES.WGT };
        }

        const factory = new ethers.Contract(CONTRACT_ADDRESSES.factory, FACTORY_ABI, provider);
        const pairAddress = await factory.getPair(queryTokenA.address, queryTokenB.address);
        
        if (pairAddress === '0x0000000000000000000000000000000000000000') {
            return;
        }
        
        const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
        
        const [reserves, totalSupply, token0Address, token1Address] = await Promise.all([
            pairContract.getReserves(),
            pairContract.totalSupply(),
            pairContract.token0(),
            pairContract.token1()
        ]);
        
        const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, provider);
        const token1Contract = new ethers.Contract(token1Address, ERC20_ABI, provider);
        
        const [token0Decimals, token1Decimals] = await Promise.all([
            token0Contract.decimals(),
            token1Contract.decimals()
        ]);
        
        const reserve0 = parseFloat(ethers.utils.formatUnits(reserves._reserve0, token0Decimals));
        const reserve1 = parseFloat(ethers.utils.formatUnits(reserves._reserve1, token1Decimals));
        const totalSupplyFloat = parseFloat(ethers.utils.formatEther(totalSupply));
        
        if (totalSupplyFloat > 0) {
            const ratio = lpAmount / totalSupplyFloat;
            
            let amountA, amountB;
            if (queryTokenA.address.toLowerCase() === token0Address.toLowerCase()) {
                amountA = reserve0 * ratio;
                amountB = reserve1 * ratio;
            } else {
                amountA = reserve1 * ratio;
                amountB = reserve0 * ratio;
            }
            
            const amountAInt = Math.floor(amountA);
            const amountBInt = Math.floor(amountB);
            
            document.getElementById('removeTokenA').textContent = `${amountAInt} ${tokenA.symbol}`;
            document.getElementById('removeTokenB').textContent = `${amountBInt} ${tokenB.symbol}`;
        }
        
    } catch (error) {
        console.error('计算移除流动性金额失败:', error);
    }
}

// 处理Swap界面的百分比选择（使用ethers.js）
async function handleSwapPercentageSelect(event) {
    const percentage = parseInt(event.target.dataset.percentage);
    const tokenInputBox = event.target.closest('.token-input');
    
    if (!tokenInputBox) {
        return;
    }
    
    const isFromBox = tokenInputBox.querySelector('#fromTokenSelect');
    
    if (isFromBox) {
        const fromAmountInput = document.getElementById('fromAmount');
        
        tokenInputBox.querySelectorAll('.percentage-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        event.target.classList.add('active');
        
        const fromSelect = document.getElementById('fromTokenSelect');
        if (!fromSelect.dataset.token) {
            showNotification({
                zh: '请先选择代币',
                en: 'Please select a token first'
            }, 'error');
            return;
        }
        
        const fromToken = JSON.parse(fromSelect.dataset.token);
        
        try {
            let balance;
            if (fromToken.address === '0x0000000000000000000000000000000000000000') {
                const balanceBN = await provider.getBalance(userAccount);
                balance = ethers.utils.formatEther(balanceBN);
            } else {
                const contract = new ethers.Contract(fromToken.address, ERC20_ABI, provider);
                const balanceBN = await contract.balanceOf(userAccount);
                balance = ethers.utils.formatUnits(balanceBN, fromToken.decimals);
            }
            
            const balanceNum = parseFloat(balance);
            if (balanceNum > 0) {
                const amount = (balanceNum * percentage) / 100;
                fromAmountInput.value = amount.toFixed(2);
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

// 检查流动性表单
function checkLiquidityForm() {
    const selectA = document.getElementById('liquidityATokenSelect');
    const selectB = document.getElementById('liquidityBTokenSelect');
    const tokenA = selectA.dataset.token;
    const tokenB = selectB.dataset.token;
    const amountA = document.getElementById('liquidityAAmount').value;
    const amountB = document.getElementById('liquidityBAmount').value;
    
    const addLiquidityBtn = document.getElementById('addLiquidityBtn');
    
    const tokenASymbol = selectA.querySelector('.token-symbol')?.textContent;
    const tokenBSymbol = selectB.querySelector('.token-symbol')?.textContent;
    
    const hasTokenA = tokenASymbol && tokenASymbol.trim() !== '';
    const hasTokenB = tokenBSymbol && tokenBSymbol.trim() !== '';
    const hasAmountA = amountA && parseFloat(amountA) > 0;
    const hasAmountB = amountB && parseFloat(amountB) > 0;
    
    if (hasTokenA && hasTokenB && hasAmountA && hasAmountB) {
        if (tokenASymbol === tokenBSymbol) {
            const sameTokenText = currentLanguage === 'zh' ? '不能选择相同代币' : 'Cannot select same token';
            addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${sameTokenText}`;
            addLiquidityBtn.disabled = true;
        } else {
            checkLiquidityBalance(tokenA, tokenB, amountA, amountB, addLiquidityBtn);
        }
    } else {
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
    }
}

// 检查流动性余额（使用ethers.js）
async function checkLiquidityBalance(tokenA, tokenB, amountA, amountB, addLiquidityBtn) {
    try {
        if (!userAccount || !provider) {
            const noWalletText = currentLanguage === 'zh' ? '请先连接钱包' : 'Please connect wallet first';
            addLiquidityBtn.innerHTML = `<i class="fas fa-wallet"></i> ${noWalletText}`;
            addLiquidityBtn.disabled = true;
            return;
        }

        const tokenAInfo = JSON.parse(tokenA);
        const tokenBInfo = JSON.parse(tokenB);
        
        let balanceA, balanceB;
        
        if (tokenAInfo.address === '0x0000000000000000000000000000000000000000') {
            const balanceBN = await provider.getBalance(userAccount);
            balanceA = parseFloat(ethers.utils.formatEther(balanceBN));
        } else {
            const tokenAContract = new ethers.Contract(tokenAInfo.address, ERC20_ABI, provider);
            const balanceBN = await tokenAContract.balanceOf(userAccount);
            balanceA = parseFloat(ethers.utils.formatUnits(balanceBN, tokenAInfo.decimals));
        }
        
        if (tokenBInfo.address === '0x0000000000000000000000000000000000000000') {
            const balanceBN = await provider.getBalance(userAccount);
            balanceB = parseFloat(ethers.utils.formatEther(balanceBN));
        } else {
            const tokenBContract = new ethers.Contract(tokenBInfo.address, ERC20_ABI, provider);
            const balanceBN = await tokenBContract.balanceOf(userAccount);
            balanceB = parseFloat(ethers.utils.formatUnits(balanceBN, tokenBInfo.decimals));
        }
        
        const amountANum = parseFloat(amountA);
        const amountBNum = parseFloat(amountB);
        
        if (balanceA < amountANum) {
            const insufficientText = currentLanguage === 'zh' 
                ? `${tokenAInfo.symbol}余额不足` 
                : `Insufficient ${tokenAInfo.symbol} balance`;
            addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${insufficientText}`;
            addLiquidityBtn.disabled = true;
            return;
        }
        
        if (balanceB < amountBNum) {
            const insufficientText = currentLanguage === 'zh' 
                ? `${tokenBInfo.symbol}余额不足` 
                : `Insufficient ${tokenBInfo.symbol} balance`;
            addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${insufficientText}`;
            addLiquidityBtn.disabled = true;
            return;
        }
        
        const priceRatio = await getTokenPriceRatio(tokenAInfo, tokenBInfo);
        
        if (priceRatio === null) {
            const createPoolText = currentLanguage === 'zh' ? '创建新池子' : 'Create New Pool';
            addLiquidityBtn.innerHTML = `<i class="fas fa-plus-circle"></i> ${createPoolText}`;
            addLiquidityBtn.disabled = false;
        } else {
            const currentRatio = amountANum / amountBNum;
            const priceDifference = Math.abs(currentRatio - priceRatio) / priceRatio;
            
            if (priceDifference > 0.25) {
                const priceWarningText = currentLanguage === 'zh' 
                    ? '价格比例偏差较大' 
                    : 'Price ratio deviation too large';
                addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${priceWarningText}`;
                addLiquidityBtn.disabled = true;
            } else {
                const addLiquidityText = currentLanguage === 'zh' ? '添加流动性' : 'Add Liquidity';
                addLiquidityBtn.innerHTML = `<i class="fas fa-plus-circle"></i> ${addLiquidityText}`;
                addLiquidityBtn.disabled = false;
            }
        }
        
    } catch (error) {
        console.error('检查流动性余额失败:', error);
        const errorText = currentLanguage === 'zh' ? '检查余额失败' : 'Balance check failed';
        addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${errorText}`;
        addLiquidityBtn.disabled = true;
    }
}

// 强制刷新流动性按钮状态
function forceRefreshLiquidityButton() {
    const addLiquidityBtn = document.getElementById('addLiquidityBtn');
    if (!addLiquidityBtn) return;
    
    if (!addLiquidityBtn.innerHTML.includes('<i class=')) {
        const buttonText = addLiquidityBtn.textContent;
        
        if (buttonText.includes('Please fill') || buttonText.includes('请填写')) {
            addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${buttonText}`;
        } else if (buttonText.includes('Insufficient') || buttonText.includes('余额不足')) {
            addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${buttonText}`;
        } else if (buttonText.includes('Cannot select') || buttonText.includes('不能选择')) {
            addLiquidityBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${buttonText}`;
        } else if (buttonText.includes('Please connect') || buttonText.includes('请先连接')) {
            addLiquidityBtn.innerHTML = `<i class="fas fa-wallet"></i> ${buttonText}`;
        } else if (buttonText.includes('Add Liquidity') || buttonText.includes('添加流动性')) {
            addLiquidityBtn.innerHTML = `<i class="fas fa-plus-circle"></i> ${buttonText}`;
        } else if (buttonText.includes('Create New Pool') || buttonText.includes('创建新池子')) {
            addLiquidityBtn.innerHTML = `<i class="fas fa-plus-circle"></i> ${buttonText}`;
        }
    }
}

// 显示加载状态
function showLoading(show, message = null) {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = overlay.querySelector('p');
    
    if (show) {
        if (message) {
            loadingText.textContent = message;
        } else {
            const defaultMessage = currentLanguage === 'zh' ? '处理交易中...' : 'Processing transaction...';
            loadingText.textContent = defaultMessage;
        }
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
    }
}

// 执行交换（使用ethers.js）
async function executeSwap() {
    if (!userAccount) {
        await connectWallet();
        return;
    }
    
    const fromAmount = document.getElementById('fromAmount').value;
    const toAmountDisplay = document.getElementById('toAmountDisplay').textContent;
    const fromSelect = document.getElementById('fromTokenSelect');
    const toSelect = document.getElementById('toTokenSelect');
    
    const fromSymbol = fromSelect.querySelector('.token-symbol')?.textContent;
    const toSymbol = toSelect.querySelector('.token-symbol')?.textContent;
    
    const hasFromToken = fromSymbol && fromSymbol.trim() !== '';
    const hasToToken = toSelect.dataset.token;
    const hasFromAmount = fromAmount && parseFloat(fromAmount) > 0;
    const hasValidOutput = toAmountDisplay && toAmountDisplay !== '0.0' && !toAmountDisplay.includes('Select Token') && !toAmountDisplay.includes('计算失败');
    
    if (!hasFromToken || !hasToToken || !hasFromAmount || !hasValidOutput) {
        showNotification({
            zh: '请填写完整信息',
            en: 'Please fill in complete information'
        }, 'error');
        return;
    }
    
    const swapMessage = currentLanguage === 'zh' ? '正在兑换中...' : 'Swapping...';
    showLoading(true, swapMessage);
    
    try {
        const fromToken = JSON.parse(fromSelect.dataset.token);
        const toToken = JSON.parse(toSelect.dataset.token);
        
        // 检查授权额度（仅对非GT代币，只检查一次）
        if (fromToken.address !== '0x0000000000000000000000000000000000000000') {
            console.log('检查输入代币授权额度:', {
                tokenSymbol: fromToken.symbol,
                tokenAddress: fromToken.address,
                amount: fromAmount,
                routerAddress: CONTRACT_ADDRESSES.router
            });
            
            // 计算金额
            let fromAmountWei;
            try {
                const amountNum = parseFloat(fromAmount);
                if (isNaN(amountNum) || amountNum <= 0) {
                    throw new Error('Invalid amount');
                }
                fromAmountWei = ethers.utils.parseUnits(
                    amountNum.toString(), 
                    fromToken.decimals
                );
            } catch (e) {
                console.error('金额格式转换失败:', e);
                showNotification({
                    zh: '金额格式错误',
                    en: 'Invalid amount format'
                }, 'error');
                showLoading(false);
                return;
            }
            
            // 只检查一次授权
            const hasEnoughAllowance = await checkTokenAllowance(
                fromToken.address, 
                CONTRACT_ADDRESSES.router, 
                fromAmountWei.toString()
            );
            
            console.log('授权额度检查结果:', hasEnoughAllowance);
            
            if (!hasEnoughAllowance) {
                console.log('授权额度不足，开始授权...');
                try {
                    const tokenContract = new ethers.Contract(fromToken.address, ERC20_ABI, signer);
                    const maxAmount = ethers.constants.MaxUint256;
                    
                    const approveTx = await tokenContract.approve(CONTRACT_ADDRESSES.router, maxAmount, {
                        gasLimit: 100000
                    });
                    
                    console.log('等待授权确认...');
                    const receipt = await approveTx.wait();
                    
                    if (receipt.status !== 1) {
                        throw new Error('授权交易失败');
                    }
                    
                    console.log('授权成功');
                    showNotification({
                        zh: '代币授权成功',
                        en: 'Token approved successfully'
                    }, 'success');
                } catch (approveError) {
                    console.error('授权失败:', approveError);
                    showNotification({
                        zh: '代币授权失败',
                        en: 'Token approval failed'
                    }, 'error');
                    showLoading(false);
                    return;
                }
            }
        }
        
        // 执行交换 - 这部分必须执行！
        console.log('开始执行交换...');
        
        // GT和WGT之间的直接转换
        if ((fromToken.symbol === 'GT' && toToken.symbol === 'WGT') || 
            (fromToken.symbol === 'WGT' && toToken.symbol === 'GT')) {
            await handleGTWGTConversion(fromToken, toToken, fromAmount);
        } else {
            // 使用router进行交换
            await handleRouterSwap(fromToken, toToken, fromAmount, toAmountDisplay);
        }
        
        const swapSuccessMessage = currentLanguage === 'zh' ? '交换成功！' : 'Swap successful!';
        showNotification(swapSuccessMessage, 'success');
        
        // 清空输入框
        document.getElementById('fromAmount').value = '';
        document.getElementById('toAmountDisplay').textContent = '0.0';
        
        // 更新余额
        await updateBalance('fromBalance', fromToken);
        await updateBalance('toBalance', toToken);
        
    } catch (error) {
        console.error('交换失败:', error);
        
        let errorMessage = currentLanguage === 'zh' ? '交换失败' : 'Swap failed';
        
        if (error.message.includes('insufficient funds')) {
            errorMessage = currentLanguage === 'zh' ? '余额不足' : 'Insufficient funds';
        } else if (error.message.includes('user rejected')) {
            errorMessage = currentLanguage === 'zh' ? '用户取消交易' : 'Transaction cancelled by user';
        } else if (error.message.includes('INSUFFICIENT_OUTPUT_AMOUNT')) {
            errorMessage = currentLanguage === 'zh' ? '输出金额不足，请调整滑点' : 'Insufficient output amount, adjust slippage';
        } else {
            errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
    } finally {
        showLoading(false);
    }
}

// 处理GT和WGT之间的转换（使用ethers.js）
async function handleGTWGTConversion(fromToken, toToken, amount) {
    const amountIn = ethers.utils.parseEther(amount);
    
    if (fromToken.symbol === 'GT' && toToken.symbol === 'WGT') {
        // GT -> WGT (包装)
        const wgtContract = new ethers.Contract(CONTRACT_ADDRESSES.WGT, WGT_ABI, signer);
        const tx = await wgtContract.deposit({ value: amountIn });
        await tx.wait();
    } else if (fromToken.symbol === 'WGT' && toToken.symbol === 'GT') {
        // WGT -> GT (解包)
        const wgtContract = new ethers.Contract(CONTRACT_ADDRESSES.WGT, WGT_ABI, signer);
        const tx = await wgtContract.withdraw(amountIn);
        await tx.wait();
    }
}



// 在script.js中添加或修复这个函数
async function approveTokenMax(tokenAddress, spenderAddress) {
    try {
        if (!provider || !signer || !userAccount) {
            console.log('Provider或用户账户未连接');
            return false;
        }
        
        if (tokenAddress === '0x0000000000000000000000000000000000000000') {
            console.log('GT代币不需要授权');
            return true;
        }

        console.log('开始最大授权:', {
            tokenAddress: tokenAddress,
            spenderAddress: spenderAddress,
            ownerAddress: userAccount
        });
        
        // 创建ERC20合约实例（使用signer进行交易）
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        
        // 使用最大uint256值进行授权
        const maxAmount = ethers.constants.MaxUint256;
        
        // 发送授权交易
        const tx = await tokenContract.approve(spenderAddress, maxAmount, {
            gasLimit: 100000
        });
        
        console.log('授权交易已发送:', tx.hash);
        
        // 等待交易确认
        const receipt = await tx.wait();
        if (receipt.status === 1) {
            console.log('授权成功');
            showNotification({
                zh: '代币授权成功',
                en: 'Token approved successfully'
            }, 'success');
            return true;
        } else {
            console.log('授权失败');
            return false;
        }
        
    } catch (error) {
        console.error('Token授权失败:', error);
        showNotification({
            zh: '代币授权失败: ' + error.message,
            en: 'Token approval failed: ' + error.message
        }, 'error');
        return false;
    }
}


// 处理通过router的交换（使用ethers.js）
async function handleRouterSwap(fromToken, toToken, fromAmount, toAmountDisplay) {
    console.log('handleRouterSwap 开始执行:', {
        fromToken: fromToken.symbol,
        toToken: toToken.symbol,
        fromAmount: fromAmount,
        toAmountDisplay: toAmountDisplay
    });
    
    const router = new ethers.Contract(CONTRACT_ADDRESSES.router, ROUTER_ABI, signer);
    
    const amountNum = parseFloat(fromAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('Invalid input amount');
    }
    
    let amountIn;
    if (fromToken.address === '0x0000000000000000000000000000000000000000') {
        amountIn = ethers.utils.parseEther(amountNum.toString());
    } else {
        // 对于ERC20代币，使用parseUnits
        amountIn = ethers.utils.parseUnits(amountNum.toString(), fromToken.decimals);
    }
    
    const outputNum = parseFloat(toAmountDisplay) || parseFloat(toAmountDisplay.replace(/[^0-9.]/g, ''));
    const slippageMultiplier = (1 - slippage / 100);
    
    let amountOutMin;
    if (toToken.address === '0x0000000000000000000000000000000000000000') {
        const minAmount = outputNum * slippageMultiplier;
        amountOutMin = ethers.utils.parseEther(minAmount.toString());
    } else {
        const minAmount = outputNum * slippageMultiplier;
        amountOutMin = ethers.utils.parseUnits(minAmount.toString(), toToken.decimals);
    }
    
    // 构建交换路径
    let path;
    if (fromToken.address === '0x0000000000000000000000000000000000000000') {
        path = [CONTRACT_ADDRESSES.WGT, toToken.address];
    } else if (toToken.address === '0x0000000000000000000000000000000000000000') {
        path = [fromToken.address, CONTRACT_ADDRESSES.WGT];
    } else {
        if (fromToken.address === CONTRACT_ADDRESSES.WGT || toToken.address === CONTRACT_ADDRESSES.WGT) {
            path = [fromToken.address, toToken.address];
        } else {
            path = [fromToken.address, CONTRACT_ADDRESSES.WGT, toToken.address];
        }
    }
    
    const deadlineValue = document.getElementById('deadline')?.value || '20';
    const deadline = Math.floor(Date.now() / 1000) + (parseInt(deadlineValue) * 60);
    
    console.log('准备发送交换交易:', {
        amountIn: amountIn.toString(),
        amountOutMin: amountOutMin.toString(),
        path: path,
        deadline: deadline
    });
    
    let tx;
    
    try {
        if (fromToken.address === '0x0000000000000000000000000000000000000000') {
            // GT -> Token
            console.log('执行 GT -> Token 交换');
            tx = await router.swapExactETHForTokens(
                amountOutMin,
                path,
                userAccount,
                deadline,
                { value: amountIn, gasLimit: 300000 }
            );
        } else if (toToken.address === '0x0000000000000000000000000000000000000000') {
            // Token -> GT
            console.log('执行 Token -> GT 交换');
            tx = await router.swapExactTokensForETH(
                amountIn,
                amountOutMin,
                path,
                userAccount,
                deadline,
                { gasLimit: 300000 }
            );
        } else {
            // Token -> Token
            console.log('执行 Token -> Token 交换');
            tx = await router.swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                path,
                userAccount,
                deadline,
                { gasLimit: 300000 }
            );
        }
        
        console.log('交易已发送:', tx.hash);
        showNotification({
            zh: `交易已发送: ${tx.hash.slice(0,10)}...`,
            en: `Transaction sent: ${tx.hash.slice(0,10)}...`
        }, 'info');
        
        console.log('等待交易确认...');
        const receipt = await tx.wait();
        console.log('交易确认完成:', receipt);
        
    } catch (swapError) {
        console.error('交换交易失败:', swapError);
        throw swapError;
    }
}

// 执行添加流动性（使用ethers.js）
async function executeAddLiquidity() {
    if (!userAccount) {
        showNotification({
            zh: '请先连接钱包',
            en: 'Please connect wallet first'
        }, 'error');
        return;
    }
    
    const amountA = document.getElementById('liquidityAAmount').value;
    const amountB = document.getElementById('liquidityBAmount').value;
    const selectA = document.getElementById('liquidityATokenSelect');
    const selectB = document.getElementById('liquidityBTokenSelect');
    
    if (!amountA || !amountB || !selectA.dataset.token || !selectB.dataset.token) {
        showNotification({
            zh: '请填写完整信息',
            en: 'Please fill in complete information'
        }, 'error');
        return;
    }
    
    const tokenA = JSON.parse(selectA.dataset.token);
    const tokenB = JSON.parse(selectB.dataset.token);
    
    if (tokenA.symbol === tokenB.symbol) {
        showNotification({
            zh: '不能选择相同的代币',
            en: 'Cannot select the same token'
        }, 'error');
        return;
    }
    
    const liquidityMessage = currentLanguage === 'zh' ? '正在添加流动性...' : 'Adding liquidity...';
    showLoading(true, liquidityMessage);
    
    try {
        const router = new ethers.Contract(CONTRACT_ADDRESSES.router, ROUTER_ABI, signer);
        
        const finalSlippage = slippage;
        const amountADesired = ethers.utils.parseUnits(amountA, tokenA.decimals);
        const amountBDesired = ethers.utils.parseUnits(amountB, tokenB.decimals);
        const amountAMin = ethers.utils.parseUnits(
            (parseFloat(amountA) * (1 - finalSlippage / 100)).toString(),
            tokenA.decimals
        );
        const amountBMin = ethers.utils.parseUnits(
            (parseFloat(amountB) * (1 - finalSlippage / 100)).toString(),
            tokenB.decimals
        );
        const deadline = Math.floor(Date.now() / 1000) + (parseInt(document.getElementById('deadline').value) * 60);
        
        let tx;
        
        if (tokenA.address === '0x0000000000000000000000000000000000000000' || tokenB.address === '0x0000000000000000000000000000000000000000') {
            // 包含GT的流动性添加
            const token = tokenA.address === '0x0000000000000000000000000000000000000000' ? tokenB : tokenA;
            const amountTokenDesired = tokenA.address === '0x0000000000000000000000000000000000000000' ? amountBDesired : amountADesired;
            const amountTokenMin = tokenA.address === '0x0000000000000000000000000000000000000000' ? amountBMin : amountAMin;
            const amountETHMin = tokenA.address === '0x0000000000000000000000000000000000000000' ? amountAMin : amountBMin;
            const amountETH = tokenA.address === '0x0000000000000000000000000000000000000000' ? amountADesired : amountBDesired;
            
            // 先授权代币
            const tokenContract = new ethers.Contract(token.address, ERC20_ABI, signer);
            const approveTx = await tokenContract.approve(CONTRACT_ADDRESSES.router, amountTokenDesired);
            await approveTx.wait();
            
            tx = await router.addLiquidityETH(
                token.address,
                amountTokenDesired,
                amountTokenMin,
                amountETHMin,
                userAccount,
                deadline,
                { value: amountETH, gasLimit: 300000 }
            );
        } else {
            // Token -> Token 流动性添加
            // 先授权两个代币
            const tokenAContract = new ethers.Contract(tokenA.address, ERC20_ABI, signer);
            const tokenBContract = new ethers.Contract(tokenB.address, ERC20_ABI, signer);
            
            const approveATx = await tokenAContract.approve(CONTRACT_ADDRESSES.router, amountADesired);
            await approveATx.wait();
            
            const approveBTx = await tokenBContract.approve(CONTRACT_ADDRESSES.router, amountBDesired);
            await approveBTx.wait();
            
            tx = await router.addLiquidity(
                tokenA.address,
                tokenB.address,
                amountADesired,
                amountBDesired,
                amountAMin,
                amountBMin,
                userAccount,
                deadline,
                { gasLimit: 300000 }
            );
        }
        
        await tx.wait();
        
        showNotification({
            zh: '流动性添加成功',
            en: 'Liquidity added successfully'
        }, 'success');
        
        console.log('交易哈希:', tx.hash);
        
        // 更新余额
        updateBalance('liquidityABalance', tokenA);
        updateBalance('liquidityBBalance', tokenB);
        
    } catch (error) {
        console.error('添加流动性失败:', error);
        showNotification({
            zh: '添加流动性失败: ' + error.message,
            en: 'Failed to add liquidity: ' + error.message
        }, 'error');
    } finally {
        showLoading(false);
    }
}

// 执行撤出流动性（使用ethers.js）
async function executeRemoveLiquidity() {
    if (!userAccount) {
        showNotification({
            zh: '请先连接钱包',
            en: 'Please connect wallet first'
        }, 'error');
        return;
    }
    
    const lpAmount = document.getElementById('lpTokenAmount').value;
    
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
    
    const { tokenA, tokenB, queryTokenA, queryTokenB, pairAddress } = window.currentLiquidityPool;
    
    const removeLiquidityMessage = currentLanguage === 'zh' ? '正在撤出流动性...' : 'Removing liquidity...';
    showLoading(true, removeLiquidityMessage);
    
    try {
        const router = new ethers.Contract(CONTRACT_ADDRESSES.router, ROUTER_ABI, signer);
        
        // 处理LP数量
        const lpAmountFloat = parseFloat(lpAmount);
        let lpAmountInt = lpAmountFloat - Math.floor(lpAmountFloat) > 0.1 ? Math.ceil(lpAmountFloat) : Math.floor(lpAmountFloat);
        lpAmountInt = Math.max(1, lpAmountInt);
        
        const lpAmountWei = ethers.utils.parseEther(lpAmountInt.toString());
        const deadlineMinutes = parseInt(document.getElementById('deadline').value) || 20;
        const deadline = Math.floor(Date.now() / 1000) + (deadlineMinutes * 60);
        
        // 检查LP代币余额
        const lpContract = new ethers.Contract(pairAddress, ["function balanceOf(address) view returns (uint256)"], provider);
        const lpBalanceWei = await lpContract.balanceOf(userAccount);
        
        // 确保不超过实际余额
        let actualLpAmountWei = lpAmountWei;
        if (lpAmountWei.gt(lpBalanceWei)) {
            // 使用99.9%的实际余额
            actualLpAmountWei = lpBalanceWei.mul(999).div(1000);
        }
        
        // 检查并授权LP代币
        const hasAllowance = await checkTokenAllowance(pairAddress, CONTRACT_ADDRESSES.router, actualLpAmountWei.toString());
        if (!hasAllowance) {
            const approvalSuccess = await approveTokenMax(pairAddress, CONTRACT_ADDRESSES.router);
            if (!approvalSuccess) {
                throw new Error('LP token approval failed');
            }
        }
        
        // 使用0作为最小接受金额以避免下溢错误
        const amountTokenMin = ethers.BigNumber.from(0);
        const amountETHMin = ethers.BigNumber.from(0);
        
        let tx;
        
        if (tokenA.address === '0x0000000000000000000000000000000000000000' || 
            tokenB.address === '0x0000000000000000000000000000000000000000') {
            // 包含GT的流动性撤出
            const token = tokenA.address === '0x0000000000000000000000000000000000000000' ? queryTokenB : queryTokenA;
            
            tx = await router.removeLiquidityETH(
                token.address,
                actualLpAmountWei,
                amountTokenMin,
                amountETHMin,
                userAccount,
                deadline,
                { gasLimit: 500000 }
            );
        } else {
            // Token -> Token 流动性撤出
            tx = await router.removeLiquidity(
                queryTokenA.address,
                queryTokenB.address,
                actualLpAmountWei,
                amountTokenMin,
                amountETHMin,
                userAccount,
                deadline,
                { gasLimit: 500000 }
            );
        }
        
        await tx.wait();
        
        showNotification({
            zh: '流动性撤出成功',
            en: 'Liquidity removed successfully'
        }, 'success');
        
        console.log('交易哈希:', tx.hash);
        
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
        
        let errorMessage = {
            zh: '撤出流动性失败',
            en: 'Failed to remove liquidity'
        };
        
        if (error.message && error.message.includes('ds-math-sub-underflow')) {
            errorMessage = {
                zh: '数学下溢错误：池子储备量极不平衡。建议先少量测试撤出',
                en: 'Math underflow error: Extremely unbalanced pool reserves. Try small amount first'
            };
        } else if (error.message && error.message.includes('insufficient')) {
            errorMessage = {
                zh: '余额不足或授权不足',
                en: 'Insufficient balance or allowance'
            };
        }
        
        showNotification(errorMessage, 'error');
    } finally {
        showLoading(false);
    }
}

// 检查是否是新池子（使用ethers.js）
async function checkIfNewPool(tokenA, tokenB) {
    try {
        if (!provider) return false;
        
        let queryTokenA = tokenA;
        let queryTokenB = tokenB;
        
        if (tokenA.address === '0x0000000000000000000000000000000000000000') {
            queryTokenA = { ...tokenA, address: CONTRACT_ADDRESSES.WGT };
        }
        
        if (tokenB.address === '0x0000000000000000000000000000000000000000') {
            queryTokenB = { ...tokenB, address: CONTRACT_ADDRESSES.WGT };
        }
        
        const factory = new ethers.Contract(CONTRACT_ADDRESSES.factory, FACTORY_ABI, provider);
        const pairAddress = await factory.getPair(queryTokenA.address, queryTokenB.address);
        
        return pairAddress === '0x0000000000000000000000000000000000000000';
    } catch (error) {
        console.error('检查池子状态失败:', error);
        return false;
    }
}

// 检查流动性（使用ethers.js）
async function checkLiquidity(fromToken, toToken) {
    try {
        if (!provider) return false;
        
        // GT和WGT之间的转换直接返回true
        if ((fromToken.symbol === 'GT' && toToken.symbol === 'WGT') || 
            (fromToken.symbol === 'WGT' && toToken.symbol === 'GT')) {
            return true;
        }
        
        const router = new ethers.Contract(CONTRACT_ADDRESSES.router, ROUTER_ABI, provider);
        
        // 构建交换路径
        let path;
        if (fromToken.address === '0x0000000000000000000000000000000000000000') {
            path = [CONTRACT_ADDRESSES.WGT, toToken.address];
        } else if (toToken.address === '0x0000000000000000000000000000000000000000') {
            path = [fromToken.address, CONTRACT_ADDRESSES.WGT];
        } else {
            if (fromToken.address === CONTRACT_ADDRESSES.WGT || toToken.address === CONTRACT_ADDRESSES.WGT) {
                path = [fromToken.address, toToken.address];
            } else {
                path = [fromToken.address, CONTRACT_ADDRESSES.WGT, toToken.address];
            }
        }
        
        const fromAmount = document.getElementById('fromAmount').value;
        const amountNum = parseFloat(fromAmount);
        if (!fromAmount || isNaN(amountNum) || amountNum <= 0) {
            return false;
        }
        
        const amountIn = ethers.utils.parseUnits(amountNum.toString(), fromToken.decimals);
        
        try {
            const amounts = await router.getAmountsOut(amountIn, path);
            const hasLiquidity = amounts && amounts.length > 0 && amounts[amounts.length - 1].gt(0);
            return hasLiquidity;
        } catch (error) {
            console.log('流动性检查失败:', error.message);
            return true; // 发生异常时返回true，让用户尝试
        }
        
    } catch (error) {
        console.error('流动性检查异常:', error);
        return true;
    }
}

// 获取池子储备量信息（使用ethers.js）
async function getPoolReserves(tokenA, tokenB) {
    try {
        if (!provider) return null;
        
        let queryTokenA = tokenA;
        let queryTokenB = tokenB;
        
        if (tokenA.address === '0x0000000000000000000000000000000000000000') {
            queryTokenA = { ...tokenA, address: CONTRACT_ADDRESSES.WGT };
        }
        
        if (tokenB.address === '0x0000000000000000000000000000000000000000') {
            queryTokenB = { ...tokenB, address: CONTRACT_ADDRESSES.WGT };
        }

        const factory = new ethers.Contract(CONTRACT_ADDRESSES.factory, FACTORY_ABI, provider);
        const pairAddress = await factory.getPair(queryTokenA.address, queryTokenB.address);
        
        if (pairAddress === '0x0000000000000000000000000000000000000000') {
            return null;
        }

        const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);

        const [reserves, totalSupply, token0Address, token1Address] = await Promise.all([
            pairContract.getReserves(),
            pairContract.totalSupply(),
            pairContract.token0(),
            pairContract.token1()
        ]);

        const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, provider);
        const token1Contract = new ethers.Contract(token1Address, ERC20_ABI, provider);

        const [token0Decimals, token1Decimals] = await Promise.all([
            token0Contract.decimals(),
            token1Contract.decimals()
        ]);

        const reserve0 = parseFloat(ethers.utils.formatUnits(reserves._reserve0, token0Decimals));
        const reserve1 = parseFloat(ethers.utils.formatUnits(reserves._reserve1, token1Decimals));
        const totalSupplyFloat = parseFloat(ethers.utils.formatEther(totalSupply));

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

// 计算预期收到的代币数量
function calculateExpectedAmounts(poolInfo, lpAmount, slippagePercent = 20) {
    if (!poolInfo) return null;

    const { reserve0, reserve1, totalSupply, token0Address, token1Address, token0Decimals, token1Decimals } = poolInfo;
    
    if (totalSupply <= 0) return null;

    const ratio = lpAmount / totalSupply;
    const expectedAmount0 = reserve0 * ratio;
    const expectedAmount1 = reserve1 * ratio;

    const slippageMultiplier = (100 - slippagePercent) / 100;
    const minAmount0 = expectedAmount0 * slippageMultiplier;
    const minAmount1 = expectedAmount1 * slippageMultiplier;

    const expectedAmount0Wei = ethers.utils.parseUnits(expectedAmount0.toString(), token0Decimals);
    const expectedAmount1Wei = ethers.utils.parseUnits(expectedAmount1.toString(), token1Decimals);
    const minAmount0Wei = ethers.utils.parseUnits(minAmount0.toString(), token0Decimals);
    const minAmount1Wei = ethers.utils.parseUnits(minAmount1.toString(), token1Decimals);

    return {
        expectedAmount0: expectedAmount0Wei.toString(),
        expectedAmount1: expectedAmount1Wei.toString(),
        minAmount0: minAmount0Wei.toString(),
        minAmount1: minAmount1Wei.toString(),
        token0Address,
        token1Address,
        token0Decimals,
        token1Decimals
    };
}

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

// 转换完成！所有web3.js调用已转换为ethers.js
// 钱包检测逻辑已移除，使用直接注入方式
