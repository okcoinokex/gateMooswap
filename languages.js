// 多语言支持
const LANGUAGES = {
    zh: {
        // 导航
        swap: '交换',
        liquidity: '流动性',
        connectWallet: '连接钱包',
        gateLayer: 'Gate Layer',
        network: '网络',
        
        // 交换界面
        swapTokens: '交换代币',
        from: '从',
        to: '到',
        balance: '余额',
        max: '最大',
        price: '价格',
        slippage: '滑点',
        swap: '交换',
        
        // 流动性界面
        addLiquidity: '添加流动性',
        removeLiquidity: '撤出流动性',
        tokenA: '代币A',
        tokenB: '代币B',
        share: '份额',
        addLiquidityBtn: '添加流动性',
        removeLiquidityBtn: '撤出流动性',
        
        // 代币选择
        selectToken: '选择代币',
        searchToken: '搜索代币名称或合约地址',
        searching: '搜索中...',
        invalidContract: '无效的合约地址',
        searchFailed: '搜索失败',
        searchingContractInfo: '正在查询合约信息...',
        checkingContractValidity: '检查合约有效性...',
        gettingTokenInfo: '获取代币信息...',
        invalidContractAddress: '无效的合约地址',
        searchResults: '搜索结果',
        clickToSelectAsTarget: '点击选择为目标代币',
        selectedAsTarget: '已选择',
        pleaseConnectWallet: '请先连接钱包',
        
        // 设置
        tradingSettings: '交易设置',
        slippageTolerance: '滑点容忍度',
        transactionDeadline: '交易截止时间',
        minutes: '分钟',
        
        // 状态信息
        insufficientLiquidity: '流动性不足',
        calculating: '计算中...',
        priceCalculating: '价格计算中...',
        trySwap: '请尝试交换',
        priceWillBeDetermined: '价格将在交换时确定',
        calculationFailed: '计算失败',
        priceCalculationFailed: '价格计算失败',
        pleaseSelectToken: '请选择代币',
        selectToken: '选择代币',
        
        // 通知
        walletConnected: '钱包连接成功',
        walletDisconnected: '钱包已断开连接',
        accountSwitched: '钱包账户已切换',
        swapSuccess: '交换成功！',
        liquidityAdded: '流动性添加成功！',
        liquidityRemoved: '流动性撤出成功！',
        insufficientFunds: '余额不足',
        userRejected: '用户取消交易',
        gasInsufficient: 'Gas费用不足',
        invalidAmount: '无效的输入金额',
        invalidOutputAmount: '无效的输出金额',
        sameToken: '不能选择相同的代币',
        installWallet: '请安装MetaMask或其他Web3钱包',
        connectWalletFirst: '请先连接钱包',
        selectTokenFirst: '请先选择代币',
        fillCompleteInfo: '请填写完整信息',
        networkSwitched: '已成功切换到Gate Layer网络',
        networkAdded: '已添加并切换到Gate Layer网络',
        
        // 表单验证
        fillRequired: '请填写',
        sourceToken: '源代币',
        targetToken: '目标代币',
        swapAmount: '交换金额',
        validOutputAmount: '有效输出金额',
        tokenA: '代币A',
        tokenB: '代币B',
        amountA: '金额A',
        amountB: '金额B',
        
        // 加载状态
        processingTransaction: '处理交易中...',
        
        // 错误信息
        swapFailed: '交换失败',
        addLiquidityFailed: '添加流动性失败',
        removeLiquidityFailed: '撤出流动性失败',
        networkSwitchFailed: '切换网络失败',
        addNetworkFailed: '添加网络失败'
    },
    
    en: {
        // Navigation
        swap: 'Swap',
        liquidity: 'Liquidity',
        connectWallet: 'Connect Wallet',
        gateLayer: 'Gate Layer',
        network: 'Network',
        
        // Swap Interface
        swapTokens: 'Swap Tokens',
        from: 'From',
        to: 'To',
        balance: 'Balance',
        max: 'Max',
        price: 'Price',
        slippage: 'Slippage',
        swap: 'Swap',
        
        // Liquidity Interface
        addLiquidity: 'Add Liquidity',
        removeLiquidity: 'Remove Liquidity',
        tokenA: 'Token A',
        tokenB: 'Token B',
        share: 'Share',
        addLiquidityBtn: 'Add Liquidity',
        removeLiquidityBtn: 'Remove Liquidity',
        
        // Token Selection
        selectToken: 'Select Token',
        searchToken: 'Search token name or contract address',
        searching: 'Searching...',
        invalidContract: 'Invalid contract address',
        searchFailed: 'Search failed',
        searchingContractInfo: 'Querying contract information...',
        checkingContractValidity: 'Checking contract validity...',
        gettingTokenInfo: 'Getting token information...',
        invalidContractAddress: 'Invalid contract address',
        searchResults: 'Search Results',
        clickToSelectAsTarget: 'Click to select as target token',
        selectedAsTarget: 'Selected',
        pleaseConnectWallet: 'Please connect wallet first',
        
        // Settings
        tradingSettings: 'Trading Settings',
        slippageTolerance: 'Slippage Tolerance',
        transactionDeadline: 'Transaction Deadline',
        minutes: 'minutes',
        
        // Status Messages
        insufficientLiquidity: 'Insufficient Liquidity',
        calculating: 'Calculating...',
        priceCalculating: 'Price calculating...',
        trySwap: 'Please try swap',
        priceWillBeDetermined: 'Price will be determined during swap',
        calculationFailed: 'Calculation failed',
        priceCalculationFailed: 'Price calculation failed',
        pleaseSelectToken: 'Please select token',
        selectToken: 'Select Token',
        
        // Notifications
        walletConnected: 'Wallet connected successfully',
        walletDisconnected: 'Wallet disconnected',
        accountSwitched: 'Wallet account switched',
        swapSuccess: 'Swap successful!',
        liquidityAdded: 'Liquidity added successfully!',
        liquidityRemoved: 'Liquidity removed successfully!',
        insufficientFunds: 'Insufficient funds',
        userRejected: 'User rejected transaction',
        gasInsufficient: 'Insufficient gas',
        invalidAmount: 'Invalid input amount',
        invalidOutputAmount: 'Invalid output amount',
        sameToken: 'Cannot select the same token',
        installWallet: 'Please install MetaMask or other Web3 wallet',
        connectWalletFirst: 'Please connect wallet first',
        selectTokenFirst: 'Please select token first',
        fillCompleteInfo: 'Please fill complete info',
        networkSwitched: 'Successfully switched to Gate Layer network',
        networkAdded: 'Successfully added and switched to Gate Layer network',
        
        // Form Validation
        fillRequired: 'Please fill',
        sourceToken: 'Source Token',
        targetToken: 'Target Token',
        swapAmount: 'Swap Amount',
        validOutputAmount: 'Valid Output Amount',
        tokenA: 'Token A',
        tokenB: 'Token B',
        amountA: 'Amount A',
        amountB: 'Amount B',
        
        // Loading States
        processingTransaction: 'Processing transaction...',
        
        // Error Messages
        swapFailed: 'Swap failed',
        addLiquidityFailed: 'Add liquidity failed',
        removeLiquidityFailed: 'Remove liquidity failed',
        networkSwitchFailed: 'Network switch failed',
        addNetworkFailed: 'Add network failed'
    }
};

// 当前语言
let currentLanguage = 'en';

// 获取翻译文本
function t(key) {
    return LANGUAGES[currentLanguage][key] || key;
}

// 切换语言
function switchLanguage(lang) {
    if (LANGUAGES[lang]) {
        currentLanguage = lang;
        updateUI();
    }
}

// 更新界面文本
function updateUI() {
    // 更新导航
    document.querySelector('[data-tab="swap"]').innerHTML = `<i class="fas fa-exchange-alt"></i> ${t('swap')}`;
    document.querySelector('[data-tab="liquidity"]').innerHTML = `<i class="fas fa-plus-circle"></i> ${t('liquidity')}`;
    
    // 更新交换界面
    document.querySelector('.swap-header h2').textContent = t('swapTokens');
    document.querySelectorAll('.token-input-header span:first-child').forEach((el, index) => {
        if (index === 0) el.textContent = t('from');
        if (index === 1) el.textContent = t('to');
    });
    document.querySelectorAll('.max-btn').forEach(btn => {
        btn.textContent = t('max');
    });
    document.querySelectorAll('.price-row span:first-child').forEach((el, index) => {
        if (index === 0) el.textContent = t('price');
        if (index === 1) el.textContent = t('slippage');
    });
    document.querySelector('.swap-action-btn').innerHTML = `<i class="fas fa-exchange-alt"></i> ${t('swap')}`;
    
    // 更新流动性界面
    document.querySelector('.liquidity-header h2').textContent = t('addLiquidity');
    document.querySelectorAll('.liquidity-container .token-input-header span:first-child').forEach((el, index) => {
        if (index === 0) el.textContent = t('tokenA');
        if (index === 1) el.textContent = t('tokenB');
    });
    document.querySelector('.liquidity-action-btn').innerHTML = `<i class="fas fa-plus-circle"></i> ${t('addLiquidityBtn')}`;
    
    // 更新模态框
    document.querySelector('#tokenModal .modal-header h3').textContent = t('selectToken');
    document.querySelector('#tokenSearch').placeholder = t('searchToken');
    document.querySelector('#settingsModal .modal-header h3').textContent = t('tradingSettings');
    document.querySelector('#settingsModal .setting-item label').textContent = t('slippageTolerance');
    document.querySelector('#settingsModal .setting-item:nth-child(2) label').textContent = t('transactionDeadline');
    document.querySelector('#settingsModal .setting-item span').textContent = t('minutes');
    
    // 更新加载状态
    document.querySelector('.loading-spinner p').textContent = t('processingTransaction');
}
