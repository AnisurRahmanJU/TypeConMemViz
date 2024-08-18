format = {
    decimalSeparator: '.',
    groupSeparator: '',
    groupSize: 3,
    secondaryGroupSize: 0,
    fractionGroupSeparator: '',
    fractionGroupSize: 0
}
BigNumber.config({ FORMAT: format })
BigNumber.config(5000);


var crcs = [
    {
        name: "TASI RIMS Receiver",
        degree: 32,
        polynomial: 0x4C11DB7,
        initial: 0xFFFFFFFF,
        inputReflected: true,
        resultReflected: true,
        finalXor: 0xFFFFFFFF
    },
    {
        name: "EGNOS header",
        degree: 32,
        polynomial: 0x4C11DB7,
        initial: 0xFFFFFFFF,
        inputReflected: true,
        resultReflected: true,
        finalXor: 0xFFFFFFFF
    },
    {
        name: "Qualcomm CRC-24",
        degree: 24,
        polynomial: 0x1864CFB,
        initial: 0,
        inputReflected: false,
        resultReflected: false,
        finalXor: 0
    }
]

/* Adapted from http://www.sunshine2k.de/articles/coding/crc/understanding_crc.html */

CRC = function(options) {
    
    var defaultOptions = {
        degree: 8,
        polynomial: 0x07,
        initial: 0x00,
        inputReflected: false,
        resultReflected: false,
        finalXor: 0x00
    };
    
    this.options = $.extend(defaultOptions, options);
    this.crcTable = [];
    
    this.computeTable();
};

CRC.prototype.computeTable = function() {
    
    var mask = parseInt("80".rpad("0", this.options.degree/4), 16);
    var castMask = parseInt("FF".rpad("F", this.options.degree/4), 16);
    
    for (var divident = 0; divident < 256; divident++) /* iterate over all possible input byte values 0 - 255 */
    {
        var curByte = (divident << (this.options.degree-8)) & castMask; /* move divident byte into MSB of 32Bit CRC */
        for (var bit = 0; bit < 8; bit++)
        {
            if ((curByte & mask) != 0)
            {
                curByte <<= 1;
                curByte ^= this.options.polynomial;
            }
            else
            {
                curByte <<= 1;
            }
        }

        this.crcTable[divident] = (curByte & castMask);
    }
    
    str = "{"
    for(var i in this.crcTable) {
        str += " ,0x"+Util.getNumberAsHexStr32(this.crcTable[i]);
    }
    str += "}";
    console.log(str);
};

CRC.prototype.reflectBits = function(byte, size) {
    
    var res = 0;
    
    for(var i = 0; i < size; i++) {
        if ((byte & (1 << i)) != 0) {
            res |= (1 << ((size-1) - i));
        }
    }
    
    return res;
};

CRC.prototype.compute = function(inputByteArray) {
    
    var castMask = parseInt("FF".rpad("F", this.options.degree/4), 16);
    
    var crc = this.options.initial & castMask;
    
    for(var i = 0; i < inputByteArray.length; i++) {
        
        var byte = inputByteArray[i] & 0xFF;
        
        /* reflect input byte if specified, otherwise input byte is taken as it is */
        var rByte = ((this.options.inputReflected) ? this.reflectBits(byte, 8) : byte);
        
        /* update the MSB of crc value with next input byte */
        crc = (crc ^ (rByte << (this.options.degree - 8))) & castMask;
        /* this MSB byte value is the index into the lookup table */
        var pos = (crc >> (this.options.degree - 8)) & 0xFF;
        /* shift out this index */
        crc = (crc << 8) & castMask;
        /* XOR-in remainder from lookup table using the calculated index */
        crc = (crc ^ this.crcTable[pos]) & castMask;
    }

    /* reflect result crc if specified, otherwise calculated crc value is taken as it is */
    crc = (this.options.resultReflected ? this.reflectBits(crc, this.options.degree) : crc);
    
    /* Xor the crc value with specified final XOR value before returning */
    return ( (crc ^ this.options.finalXor) & castMask );
};

Util = function() {
    
};

Util.hexStringToByteArray = function(hexString) {
    
    var byteArray = [];
    
    /* Make sure the hex string the complete */
    if(hexString.length % 2 != 0) {
        hexString = "0" + hexString;
    }
    
    for (var i = 0; i < hexString.length; i += 2) {
        var byteHex = hexString.substr(i, 2);
        
        byteArray.push(parseInt("0x"+byteHex, 16));
    }
    
    return byteArray;
};

Util.getNumberAsHexStr32 =  function(num)
{
    var valueHigh = num >>> 16;
    var valueLow = num & 0x0000FFFF;
    return ( valueHigh.toString(16).toLowerCase().lpad('0',4) + valueLow.toString(16).toLowerCase().lpad('0',4));
};

var enaDebug = false;
function debug(str) {
    if(enaDebug) {
        console.log(str);
    }
}

$(function() {
    
    function handleIntInput(){

        var inputStr = $('#intInputStr').val();
        var inputNoSpaces = $('#intInputStr').val().replace(/\s/g, '');
        var emptyRe = /^\s*$/;
    
        var binaryRe = /^\s*(0b)?[01]+?(u{0,1}l{0,2}|l{0,2}u{0,1})?\s*$/i;
        var binaryLimit = 64;
        var binaryRadio = $('#intSelector-bin');
        var bignumValBin = new BigNumber(NaN);
    
        var hexaRe = /^\s*(0x)?[0-9A-F]+?(u{0,1}l{0,2}|l{0,2}u{0,1})?\s*$/i;
        var hexaLimit = 16;
        var hexMaxLimit = '0xFFFFFFFFFFFFFFFF';
        var hexaRadio = $('#intSelector-hexa');
        var hexLittle = $('#int-little-endian');
        var bignumValHexa = new BigNumber(NaN);
        
        /*
            C- literal: -/+1-90-9...(u,ul,l,ull,ll)
            Real/Scientific notation: -/+0-9...(./,0-9....)(e/E-/+0-9...)
        */
        var decRe = /^\s*((\-|\+)?[1-9][0-9]*?(u{0,1}l{0,2}|l{0,2}u{0,1})?|(\-|\+)?[0-9]+(((\.|,)[0-9]+)?(e(\-|\+)?[0-9]+)?)?)\s*$/i;
        var decMinLimit = '-9223372036854775808';
        var decMaxLimit = '18446744073709551615';
        var decRadio = $('#intSelector-dec');
        var bignumValDec = new BigNumber(NaN);
        
    
        var detected = false;
        var custom = false;
        var format = false;
        var bignumVal = new BigNumber(NaN);
        var auto = $('#intSelector-auto');
    
        debug('intInputStr:',inputStr);
    
        if(inputNoSpaces.match(emptyRe))
        {
            debug('Empty input string. Enable all radio.');
            $('#integerInput .selector input:radio, #integerInput .selector input:checkbox').prop('disabled', false);
            $('#integerInput .selector input:radio, #integerInput .selector input:checkbox').each(function(){ $(this).parent().parent().removeClass('disabled');});
            $('#integerInput .selector label').removeClass('selected');
            
            $('#integerInput .error').hide();
        
            populateTypes(bignumVal, 'none');
        }
        else
        {
            /* Check Decimal format (limited to 64 bits)*/
            if(inputNoSpaces.match(decRe))
            {
                /* Replace , by . */
                decimalIn = inputNoSpaces.replace(',','.');
                bignumValDec = new BigNumber(decimalIn, 10);
                debug('Decimal converted value:', bignumValDec.toString());
                
                if(!bignumValDec.isNaN() && bignumValDec.isInt())
                {
                    if(bignumValDec.greaterThanOrEqualTo(decMinLimit, 10) && bignumValDec.lessThanOrEqualTo(decMaxLimit, 10))
                    {
                        debug('Input string could be decimal.');
                        decRadio.prop('disabled', false);
                        decRadio.parent().parent().removeClass('disabled');
                        detected = true;
                        format = 'dec';
                        bignumVal = bignumValDec;
                        debug('Decimal detected:', bignumVal.toString());
                    }
                    else
                    {
                        $('#integerInput .error').show();
                        if(bignumValDec.greaterThan(decMaxLimit, 10))
                        {
                            debug('Overflowing UINT64 maximum value in decimal ('+decMaxLimit+')');
                            $('#integerInput .error .text').html('Overflowing UINT64 maximum value ('+decMaxLimit+') . (<a href="#format-help" class="internal-link alert-link">See accepted formats</a>)');
                        }
                        else
                        {
                            debug('Overflowing INT64 minimum value in decimal ('+decMinLimit+')');
                            $('#integerInput .error .text').html('Overflowing INT64 minimum value ('+decMinLimit+') . (<a href="#format-help" class="internal-link alert-link">See accepted formats</a>)');
                        }

                        decRadio.prop('disabled', true);
                        decRadio.parent().parent().addClass('disabled');
                        
                        bignumValDec = new BigNumber(NaN);
                        custom = true;
                    }
                }
                else
                {
                    debug('Input string could not be decimal (NaN or not integer).');
                    decRadio.prop('disabled', true);
                    decRadio.parent().parent().addClass('disabled');
                }
            }
            else
            {
                debug('Input string could not be decimal. (does not match regexp)');
                decRadio.prop('disabled', true);
                decRadio.parent().parent().addClass('disabled');
            }
            
            /* Check Hexadecimal format (limited to 64 bits)*/
            if(inputNoSpaces.match(hexaRe))
            {
                /* Remove 0x prefix */
                var inputHex = inputNoSpaces.replace(/0[xX]/, '');
                if(hexLittle.prop('checked') == true && inputHex.length > 2)
                {
                    var tmpHex = inputHex.lpad('0', inputHex.length+(inputHex.length%2))+"";
                    inputHex = "";
                    var len = tmpHex.length;
                    for(var i=1; i<=(len/2); i++)
                    {
                        inputHex = inputHex + tmpHex.substr(len-i*2, 2);
                    }
                }
                
                if(inputHex.length <= hexaLimit)
                {
                    debug('Input string could be hexadecimal.');
                    hexaRadio.prop('disabled', false);
                    hexLittle.prop('disabled', false);
                    hexaRadio.parent().parent().removeClass('disabled');
                    hexLittle.parent().parent().removeClass('disabled');
                    detected = true;

                    bignumValHexa = new BigNumber(inputHex, 16);
                    if(!format)
                    {
                        format = 'hexa';
                        bignumVal = bignumValHexa;
                        debug('Hexadecimal detected:', bignumVal.toString());
                    }
                }
                else
                {
                    $('#integerInput .error').show();
                    debug('Overflowing UINT64 maximum value in hexadecimal ('+hexMaxLimit+')');
                    $('#integerInput .error .text').html('Overflowing UINT64 maximum value ('+hexMaxLimit+') . (<a href="#format-help" class="internal-link alert-link">See accepted formats</a>)');
                    bignumValHexa = new BigNumber(NaN);
                    custom = true;

                    hexaRadio.prop('disabled', true);
                    hexLittle.prop('disabled', true);
                    hexaRadio.parent().parent().addClass('disabled');
                    hexLittle.parent().parent().addClass('disabled');
                }
            }
            else
            {
                debug('Input string could not be hexadecimal.');
                hexaRadio.prop('disabled', true);
                hexLittle.prop('disabled', true);
                hexaRadio.parent().parent().addClass('disabled');
                hexLittle.parent().parent().addClass('disabled');
            }
            
            /* Check Binary format (limited to 64 bits)*/
            if(inputNoSpaces.match(binaryRe))
            {
                /* Remove 0x prefix */
                var inputBin = inputNoSpaces.replace(/0[bB]/, '');
                
                if(inputBin.length <= binaryLimit)
                {
                    debug('Input string could be binary.');
                    binaryRadio.prop('disabled', false);
                    binaryRadio.parent().parent().removeClass('disabled');
                    detected = true;

                    bignumValBin = new BigNumber(inputBin, 2);
                    if(!format)
                    {
                        format = 'bin';
                        bignumVal = bignumValBin;
                        debug('Binary detected:', bignumVal.toString());
                    }
                }
                else
                {
                    $('#integerInput .error').show();
                    debug('Overflowing UINT64 maximum value in binary ('+hexMaxLimit+')');
                    $('#integerInput .error .text').html('Overflowing UINT64 maximum value ('+hexMaxLimit+') . (<a href="#format-help" class="internal-link alert-link">See accepted formats</a>)');
                    custom = true;

                    binaryRadio.prop('disabled', true);
                    binaryRadio.parent().parent().addClass('disabled');
                }
            }
            else
            {
                debug('Input string could not be binary.');
                binaryRadio.prop('disabled', true);
                binaryRadio.parent().parent().addClass('disabled');
            }
        
            if(!auto.prop('checked'))
            {
                if(decRadio.prop('checked'))
                {
                    format = 'dec';
                    bignumVal = bignumValDec;
                }
                else if(hexaRadio.prop('checked'))
                {
                    format = 'hexa';
                    bignumVal = bignumValHexa;
                }
                else
                {
                    format = 'bin';
                    bignumVal = bignumValBin;
                }
            }
            
            if(detected)
            {
                $('#integerInput .error').hide();
                populateTypes(bignumVal, format);
            }
            else
            {
                bignumVal = new BigNumber(NaN);
                populateTypes(bignumVal, format);
            }
    
            if(!detected && !custom)
            {
                $('#integerInput .error').show();
                $('#integerInput .error .text').html('Invalid input format. (<a href="#format-help" class="internal-link alert-link">See accepted formats</a>)');
                bignumVal = new BigNumber(NaN);
            
                populateTypes(bignumVal, format);
            }
            else if(!custom)
            {
                $('#integerInput .error').hide();
                $('#integerInput .error .text').html('');
            
                populateTypes(bignumVal, format);
            }
        }
    }
    
    function populateTypes(bignumVal, format)
    {
        var decVal = $('#dec-value');
        var binRadio = $('#intSelector-bin');
        var hexaRadio = $('#intSelector-hexa');
        var decRadio = $('#intSelector-dec');
        
        cformat = format;
        if(bignumVal.isNaN())
        {
            bignumVal = new BigNumber(0);
            cformat = 'dec';
        }
        
        populateInt(bignumVal, cformat, 8, "-128", "127", true);
        populateInt(bignumVal, cformat, 8, "0", "256", false);
        
        populateInt(bignumVal, cformat, 16, "-32768", "32767", true);
        populateInt(bignumVal, cformat, 16, "0", "65535", false);
        
        // populateInt(bignumVal, cformat, 24, "-8388608", "8388607", true);
        // populateInt(bignumVal, cformat, 24, "0", "16777215", false);
        
        populateInt(bignumVal, cformat, 32, "-2147483648", "2147483647", true);
        populateInt(bignumVal, cformat, 32, "0", "4294967295", false);
        
        // populateInt(bignumVal, cformat, 40, "-549755813888", "549755813887", true);
        // populateInt(bignumVal, cformat, 40, "0", "1099511627775", false);
        //
        // populateInt(bignumVal, cformat, 48, "-140737488355328", "140737488355327", true);
        // populateInt(bignumVal, cformat, 48, "0", "281474976710655", false);
        
        populateInt(bignumVal, cformat, 64, "-9223372036854776000", "9223372036854775999", true);
        populateInt(bignumVal, cformat, 64, "0", "18446744073709549999", false);
                
        decVal.text(bignumVal.toExponential());
        
        if(format == 'dec')
        {
            decRadio.parent().parent().addClass('selected');
            hexaRadio.parent().parent().removeClass('selected');
            binRadio.parent().parent().css({'color': ''});
        }
        else if(format == 'hexa')
        {
            hexaRadio.parent().parent().addClass('selected');
            decRadio.parent().parent().removeClass('selected');
            binRadio.parent().parent().removeClass('selected');
        }
        else if(format == 'bin')
        {
            binRadio.parent().parent().addClass('selected');
            decRadio.parent().parent().removeClass('selected');
            hexaRadio.parent().parent().removeClass('selected');
        }
        
        if(format == 'hexa' || format == 'bin')
        {
            $('#inter-unsigned').show();
        }
        else if(format == 'dec')
        {
            $('#inter-unsigned').hide();
        }
    }
    
    function populateInt(bignumVal, format, nbBits, minValue, maxValue, signed)
    {
        var prefix = ((signed == true) ? 's' : 'u');
        var label = prefix+'int'+nbBits;
        var val = $('#'+prefix+'int'+nbBits+'-value');
        var hex = $('#'+prefix+'int'+nbBits+'-hex');
        var binDiv = $('#'+prefix+'int'+nbBits+'-bin-div .bin-wrapper');
        var min = new BigNumber(minValue);
        var max = new BigNumber(maxValue);
        var over = $('#'+prefix+'int'+nbBits+'-overflow');
        
        if(bignumVal.greaterThan(max) || bignumVal.lessThan(min))
        {
            over.show();
            over.parentsUntil('.types', '.panel').removeClass('panel-info').addClass('panel-warning');
            
            /* In case of negative number, we first need to interprate it as a long signed integer (64 bits) */
            if(bignumVal.isNegative())
            {
                binStr = bignumVal.negated().toString(2).lpad('0', 64);
                binStr = binStr.replace(/0/g,'A');
                binStr = binStr.replace(/1/g,'0');
                binStr = binStr.replace(/A/g,'1');
                binStr = new BigNumber(binStr, 2).plus(1).negated().toString(2).lpad('0', 64);
            }
            else {
                binStr = bignumVal.toString(2).lpad('0', nbBits);
            }
            
            binStr = binStr.substr(binStr.length-nbBits, nbBits);
            debug(label+'::', 'Overflow. Keep LSB', binStr);
            bignumVal = new BigNumber(binStr, 2);
        }
        else {
            over.hide();
            over.parentsUntil('.types', '.panel').removeClass('panel-warning').addClass('panel-info');
            
            binStr = bignumVal.toString(2).lpad('0', nbBits);
        }
        
        /* If negative (sign bit), we need to interprate the number */
        if((signed == true) && (binStr.substr(0,1) == 1))
        {
            /* Negative value: 2's complement */
            /* Invert all bits */
            binStr = binStr.replace(/0/g,'A');
            binStr = binStr.replace(/1/g,'0');
            binStr = binStr.replace(/A/g,'1');
            bignumVal = new BigNumber(binStr, 2).plus(1).negated();
        }
        
        val.val(bignumVal.toString(10));
        
        hexnumVal = bignumVal;
        
        if((signed == true) && (hexnumVal.isNegative()))
        {
            /* Compute the value for hex representation */
            var binStr = hexnumVal.toString(2);
            binVal = binStr.substr(1).lpad('0', nbBits-1)
            
            /* Negative value: 2's complement */
            /* Invert all bits */
            binStr = binStr.substr(1).lpad('0', nbBits).replace(/0/g,'A')
            binStr = binStr.replace(/1/g,'0');
            binStr = binStr.replace(/A/g,'1');
            
            hexnumVal = new BigNumber(binStr, 2).plus(1);
        }
        hex.val('0x'+hexnumVal.toString(16).toUpperCase().lpad('0', nbBits/4));
        
        binDiv.html('');
        var binVal = hexnumVal.toString(2).lpad('0', nbBits);
        var container;
        for(var i=nbBits-1; i>=0; i--)
        {
            if((i+1)%8 == 0)
            {
                container = $('<div class="bitsgroup"></div>').appendTo(binDiv);
            }
            $('<span class="binaryBit bit" data-bit="'+i+'">'+binVal.substr(nbBits-1-i,1)+'</span>').appendTo(container);
        }
    }
    
    function handleCharInput()
    {

        var inputStr = $('#charInputStr').val();
        var inputNoSpaces = $('#charInputStr').val();
        var emptyRe = /^\s*$/;
    
        var binaryRadio = $('#charSelector-string');
    
        var hexaRe = /^\s*(0x)?([0-9A-F]{2})+?(u{0,1}l{0,2}|l{0,2}u{0,1})?\s*$/i;
        var hexaRadio = $('#charSelector-hexa');
        
        var detected = false;
        var custom = false;
        var format = false;
        var auto = $('#charSelector-auto');
        
        var charStr = "";
        var charHexa = "";
    
        debug('charInputStr:',inputStr);
    
        if(inputNoSpaces.match(emptyRe))
        {
            debug('Empty input string. Enable all radio.');
            $('#characterInput .selector input:radio, #characterInput .selector input:checkbox').prop('disabled', false);
            $('#characterInput .selector input:radio, #characterInput .selector input:checkbox').each(function(){ $(this).parent().parent().removeClass('disabled');});
            $('#characterInput .selector label').removeClass('selected');
            
            $('#characterInput .error').hide();
        
            populateCharacters("", 'none');
        }
        else
        {
            /* Check Hexadecimal format (limited to 64 bits)*/
            if(inputNoSpaces.match(hexaRe))
            {
                debug('Input string could be hexadecimal.');
                hexaRadio.prop('disabled', false);
                hexaRadio.parent().parent().removeClass('disabled');
                detected = true;

                if(!format)
                {
                    charHexa = inputNoSpaces.replace(/0[xX]/, '');
                    
                    format = 'hexa';
                    charStr = charHexa;
                    debug('Hexadecimal detected:', charHexa);
                }
            }
            else
            {
                debug('Input string could not be hexadecimal.');
                hexaRadio.prop('disabled', true);
                hexaRadio.parent().parent().addClass('disabled');
            }
            

            if(!format)
            {
                format = 'string';
                charStr = inputStr;
                detected = true;
                debug('String detected:', charStr);
            }
        
            if(!auto.prop('checked'))
            {
                if(hexaRadio.prop('checked'))
                {
                    format = 'hexa';
                    charStr = charHexa;
                }
                else
                {
                    format = 'string';
                    charStr = inputNoSpaces;
                }
            }
            
            if(format == 'hexa')
            {
                hexaRadio.parent().parent().addClass('selected');
                binaryRadio.parent().parent().removeClass('selected');
            }
            else if(format == 'string')
            {
                binaryRadio.parent().parent().addClass('selected');
                hexaRadio.parent().parent().removeClass('selected');
            }
            
            if(detected)
            {
                $('#characterInput .error').hide();
                populateCharacters(charStr, format);
            }
            else
            {
                populateCharacters("", format);
            }
    
            if(!detected && !custom)
            {
                $('#characterInput .error').show();
                $('#characterInput .error .text').html('Invalid input format. (<a href="#format-help" class="internal-link alert-link">See accepted formats</a>)');
                
                populateCharacters("", format);
            }
        }
    }
    
    function populateCharacters(string, format)
    {
        var label = "char";
        var val = $('#char-value');
        var hex = $('#char-hex');
        var binDiv = $('#char-bin-div .bin-wrapper');
        var min = new BigNumber("0");
        var max = new BigNumber("127");
        var over = $('#char-illegal');
        var illegal = new BigNumber(216);
        var charTable = {
            0:   "" /* NUL */,  1:   "" /* SOH */,  2:   "" /* STX */,
            3:   "" /* ETX */,  4:   "" /* EOT */,  5:   "" /* ENQ */,
            6:   "" /* ACK */,  7:   "" /* BEL */,  8:   "" /* BS */,
            9:   "" /* HT */,  10:  "" /* LF */,   11:  "" /* VT */,
            12:  "" /* FF */,  13:  "" /* CR */,   14:  "" /* SO */,
            15:  "" /* SI */,  16:  "" /* DLE */,  17:  "" /* DC1 */,
            18:  "" /* DC2 */, 19:  "" /* DC3 */,  20:  "" /* DC4 */,
            21:  "" /* NAK */, 22:  "" /* SYN */,  23:  "" /* ETB */,
            24:  "" /* CAN */, 25:  "" /* EM */,   26:  "" /* SUB */,
            27:  "" /* ESC */, 28:  "" /* FS */,   29:  "" /* GS */,
            30:  "" /* RS */,  31:  "" /* US */,  127: "␡" /* DEL */
        };
        var str = '';
        var binStr = '';
        var hexStr = '';
        
        over.hide();
        
        if(format == 'hexa')
        {
            for(var i = 0; i<string.length; i+=2)
            {
                var charCode = new BigNumber(string.substr(i,2), 16);
                if(charCode.greaterThan(max))
                {
                    over.show();
                    charCode = illegal;
                }
            
                var charNb = charCode.toNumber();
                if(charNb in charTable)
                    str += charTable[charNb];
                else
                    str += String.fromCharCode(charNb);
                
                binStr += charCode.toString(2).lpad('0',8);
            }
            
            hexStr = string;
        }
        else
        {
            for(var i = 0; i<string.length; i++)
            {
                var charCode = new BigNumber(string.charCodeAt(i));
                if(charCode.greaterThan(max))
                {
                    over.show();
                    charCode = illegal;
                }
            
                var charNb = charCode.toNumber();
                if(charNb in charTable)
                    str += charTable[charNb];
                else
                    str += String.fromCharCode(charNb);
                
                binStr += charCode.toString(2).lpad('0',8);
                hexStr += charCode.toString(16).lpad('0',2);
            }
        }

        debug(str, binStr, hexStr);
        
        val.html(str);
        hex.val('0x'+hexStr);

        binDiv.html('');
        var container;
        for(var i=binStr.length-1; i>=0; i--)
        {
            if((i+1)%8 == 0)
            {
                container = $('<div class="bitsgroup"></div>').appendTo(binDiv);
            }
            $('<span class="binaryBit bit" data-bit="'+i+'">'+binStr.substr(binStr.length-1-i,1)+'</span>').appendTo(container);
        }
        
    }
    
    function handleFloatInput(){

        var inputStr = $('#floatInputStr').val();
        var inputNoSpaces = $('#floatInputStr').val().replace(/\s/g, '');
        var emptyRe = /^\s*$/;
    
        var binaryRe = /^\s*(0b)?([01]{32}|[01]{64}|[01]{128})\s*$/i;
        var binaryLimit = 128;
        var binaryRadio = $('#floatSelector-bin');
        var bignumValBin = new BigNumber(NaN);
    
        var hexaRe = /^\s*(0x)?([0-9A-F]{8}|[0-9A-F]{16}|[0-9A-F]{32})\s*$/i;
        var hexaLimit = 32;
        var hexaRadio = $('#floatSelector-hexa');
        var hexLittle = $('#float-little-endian');
        var bignumValHexa = new BigNumber(0);
        
        /*
            C- literal: -/+1-90-9...(u,ul,l,ull,ll)
            Real/Scientific notation: -/+0-9...(./,0-9....)(e/E-/+0-9...)
        */
        var decRe = /^\s*(((\-|\+)?[1-9][0-9]*?([uU]{0,1}[lL]{0,2}|[lL]{0,2}[uU]{0,1})?|(\-|\+)?[0-9]+(((\.|,)[0-9]+)?([eE](\-|\+)?[0-9]+)?)?)|NaN|[+-]?Infinity)\s*$/;
        var decRadio = $('#floatSelector-dec');
        var bignumValDec = new BigNumber(0);
        
    
        var detected = false;
        var custom = false;
        var format = false;
        var bignumVal = new BigNumber(0);
        var auto = $('#floatSelector-auto');
    
        debug('floatInputStr:',inputNoSpaces);
    
        if(inputNoSpaces.match(emptyRe))
        {
            debug('Empty input string. Enable all radio.');
            $('#floatInput .selector input:radio, #floatInput .selector input:checkbox').prop('disabled', false);
            $('#floatInput .selector input:radio, #floatInput .selector input:checkbox').each(function(){ $(this).parent().parent().removeClass('disabled');});
            $('#floatInput .selector label').removeClass('selected');
            
            $('#floatInput .error').hide();
        
            populateFloats(inputNoSpaces, bignumVal, 'dec');
        }
        else
        {
            /* Check Decimal format */
            if(inputNoSpaces.match(decRe))
            {
                /* Replace , by . */
                decimalIn = inputNoSpaces.replace(',','.');
                bignumValDec = new BigNumber(decimalIn, 10);
                debug('Decimal converted value:', bignumValDec.toString());
                
                debug('Input string could be decimal.');
                decRadio.prop('disabled', false);
                decRadio.parent().parent().removeClass('disabled');
                detected = true;
                format = 'dec';
                bignumVal = bignumValDec;
                debug('Decimal detected:', bignumVal.toString());
            }
            else
            {
                debug('Input string could not be decimal. (does not match regexp)');
                decRadio.prop('disabled', true);
                decRadio.parent().parent().addClass('disabled');
            }
            
            /* Check Hexadecimal format (limited to 64 bits)*/
            if(inputNoSpaces.match(hexaRe))
            {
                /* Remove 0x prefix */
                var inputHex = inputNoSpaces.replace(/0[xX]/, '');
                if(hexLittle.prop('checked') == true && inputHex.length > 2)
                {
                    var tmpHex = inputHex.lpad('0', inputHex.length+(inputHex.length%2))+"";
                    inputHex = "";
                    var len = tmpHex.length;
                    for(var i=1; i<=(len/2); i++)
                    {
                        inputHex = inputHex + tmpHex.substr(len-i*2, 2);
                    }
                    debug(tmpHex, inputHex);
                }
                
                if(inputHex.length <= hexaLimit)
                {
                    debug('Input string could be hexadecimal.');
                    hexaRadio.prop('disabled', false);
                    hexLittle.prop('disabled', false);
                    hexaRadio.parent().parent().removeClass('disabled');
                    hexLittle.parent().parent().removeClass('disabled');
                    detected = true;

                    bignumValHexa = new BigNumber(inputHex, 16);
                    if(!format)
                    {
                        format = 'hexa';
                        bignumVal = bignumValHexa;
                        debug('Hexadecimal detected:', bignumVal.toString());
                    }
                }
                else
                {
                    $('#floatInput .error').show();
                    debug('Overflowing FLOAT128 maximum value in hexadecimal (128 bits)');
                    $('#floatInput .error .text').html('Overflowing FLOAT128 maximum value (128 bits) . (<a href="#format-help" class="internal-link alert-link">See accepted formats</a>)');
                    bignumValHexa = new BigNumber(NaN);
                    custom = true;

                    hexaRadio.prop('disabled', true);
                    hexLittle.prop('disabled', true);
                    hexaRadio.parent().parent().addClass('disabled');
                    hexLittle.parent().parent().addClass('disabled');
                }
            }
            else
            {
                debug('Input string could not be hexadecimal.');
                hexaRadio.prop('disabled', true);
                hexLittle.prop('disabled', true);
                hexaRadio.parent().parent().addClass('disabled');
                hexLittle.parent().parent().addClass('disabled');
            }
            
            /* Check Binary format (limited to 64 bits)*/
            if(inputNoSpaces.match(binaryRe))
            {
                /* Remove 0x prefix */
                var inputBin = inputNoSpaces.replace(/0[bB]/, '');
                
                if(inputBin.length <= binaryLimit)
                {
                    debug('Input string could be binary.');
                    binaryRadio.prop('disabled', false);
                    binaryRadio.parent().parent().removeClass('disabled');
                    detected = true;

                    bignumValBin = new BigNumber(inputBin, 2);
                    if(!format)
                    {
                        format = 'bin';
                        bignumVal = bignumValBin;
                        debug('Binary detected:', bignumVal.toString());
                    }
                }
                else
                {
                    $('#floatInput .error').show();
                    debug('Overflowing FLOAT128 maximum value in binary (128 bits)');
                    $('#floatInput .error .text').html('Overflowing FLOAT128 maximum value (128 bits) . (<a href="#format-help" class="internal-link alert-link">See accepted formats</a>)');
                    custom = true;

                    binaryRadio.prop('disabled', true);
                    binaryRadio.parent().parent().addClass('disabled');
                }
            }
            else
            {
                debug('Input string could not be binary.');
                binaryRadio.prop('disabled', true);
                binaryRadio.parent().parent().addClass('disabled');
            }
        
            if(!auto.prop('checked'))
            {
                if(decRadio.prop('checked'))
                {
                    format = 'dec';
                    bignumVal = bignumValDec;
                }
                else if(hexaRadio.prop('checked'))
                {
                    format = 'hexa';
                    bignumVal = bignumValHexa;
                }
                else
                {
                    format = 'bin';
                    bignumVal = bignumValBin;
                }
            }
            
            if(detected)
            {
                $('#floatInput .error').hide();
                populateFloats(inputNoSpaces, bignumVal, format);
            }
            else
            {
                bignumVal = new BigNumber(0);
                populateFloats(inputNoSpaces, bignumVal, format);
            }
    
            if(!detected && !custom)
            {
                $('#floatInput .error').show();
                $('#floatInput .error .text').html('Invalid input format. (<a href="#format-help" class="internal-link alert-link">See accepted formats</a>)');
                bignumVal = new BigNumber(0);
            
                populateFloats(inputNoSpaces, bignumVal, format);
            }
            else if(!custom)
            {
                $('#floatInput .error').hide();
                $('#floatInput .error .text').html('');
            
                populateFloats(inputNoSpaces, bignumVal, format);
            }
        }
    }
    
    function populateFloats(string, bignumVal, format)
    {
        var decVal = $('#float-dec-value');
        var binRadio = $('#floatSelector-bin');
        var hexaRadio = $('#floatSelector-hexa');
        var decRadio = $('#floatSelector-dec');
        
        debug('Populates:', bignumVal.toString(10));
        cformat = format;
        
        populateFloat(string, bignumVal, cformat, 32);
        populateFloat(string, bignumVal, cformat, 64);
        populateFloat(string, bignumVal, cformat, 128);
        
        decVal.text(bignumVal.toExponential());
        
        if(format == 'dec')
        {
            decRadio.parent().parent().addClass('selected');
            hexaRadio.parent().parent().removeClass('selected');
            binRadio.parent().parent().css({'color': ''});
        }
        else if(format == 'hexa')
        {
            hexaRadio.parent().parent().addClass('selected');
            decRadio.parent().parent().removeClass('selected');
            binRadio.parent().parent().removeClass('selected');
        }
        else if(format == 'bin')
        {
            binRadio.parent().parent().addClass('selected');
            decRadio.parent().parent().removeClass('selected');
            hexaRadio.parent().parent().removeClass('selected');
        }
    }
    
    function populateFloat(string, bignumVal, format, nbBits)
    {
        var label = 'float'+nbBits;
        var val = $('#float'+nbBits+'-value');
        var hex = $('#float'+nbBits+'-hex');
        var binDiv = $('#float'+nbBits+'-bin-div .bin-wrapper');
        
        var expLen = {32: 8, 64: 11, 128: 15}[nbBits];
        var mantLen = {32: 23, 64: 52, 128: 112}[nbBits];
        var expOffset = {32: 127, 64: 1023, 128: 16383}[nbBits];
        var infExp = {32: "ff", 64: "7ff", 128: "7fff"}[nbBits];
        
        if(format == "bin" || format == "hexa")
        {
            var binStr = bignumVal.toString(2).lpad('0', string.length*( (format=='bin')?1:4 )).rpad('0', nbBits).substr(0,nbBits);
            hexnumVal = new BigNumber(binStr, 2);
            
            var sign = binStr[0];
            var exponent = binStr.substr(1, expLen);
            var mantissa = binStr.substr(expLen+1, mantLen);
            
            var exponentBn = new BigNumber(exponent, 2);
            var mantissaBn = new BigNumber(mantissa, 2);

            var doubleVal;
            if(exponentBn.equals(0)) {
                if(mantissaBn.equals(0)) {
                    doubleVal = new BigNumber(( (sign == "0") ? "" : "-" )+"0");
                }
                else {
                    doubleVal = new BigNumber( (sign == "0") ? 1 : -1 ).times(new BigNumber(2).toPower(1-expOffset)).times(mantissaBn.times(new BigNumber(2).toPower(-mantLen)));
                }
            }
            else if(exponentBn.equals(infExp, 16)) {
                if(mantissaBn.equals(0)) {
                    doubleVal = new BigNumber(( (sign == "0") ? "" : "-" )+"Infinity");
                }
                else {
                    doubleVal = new BigNumber(( (sign == "0") ? "" : "-" )+"NaN");
                }
            }
            else {
                doubleVal = new BigNumber( (sign == "0") ? 1 : -1 ).times(new BigNumber(2).toPower(exponentBn.minus(expOffset))).times(mantissaBn.times(new BigNumber(2).toPower(-mantLen)).plus(1));
            }
            
            bignumVal = doubleVal;
            if(doubleVal.isFinite()) {
                var nbChar = doubleVal.floor().toString().length-1+doubleVal.decimalPlaces();
                val.val(doubleVal.toExponential(Math.min(35, nbChar)));
            }
            else {
                val.val(doubleVal.toString());
            }
        }
        else
        {
            val.val(bignumVal.toString(10));
            
            var sign = "0"
            var exp = "";
            var mantissa = "";
            /* Treat special cases before */
            if(bignumVal.equals(0)) {
                if(string[0] == "-") {
                    hexnumVal = new BigNumber("1".rpad("0", nbBits), 2);
                }
                else {
                    hexnumVal = new BigNumber("".lpad("0", nbBits/4), 16);
                }
            }
            else if(bignumVal.equals("+Infinity")) {
                hexnumVal = new BigNumber(("0"+(new BigNumber(infExp, 16).toString(2))).rpad("0", nbBits), 2);
            }
            else if(bignumVal.equals("-Infinity")) {
                hexnumVal = new BigNumber(("1"+(new BigNumber(infExp, 16).toString(2))).rpad("0", nbBits), 2);
            }
            else if(bignumVal.isNaN()) {
                debug(label, "NaN");
                hexnumVal = new BigNumber("F".lpad("F", nbBits/4), 16);
            }
            else if(bignumVal.isInteger()) {
                var binStr = bignumVal.toString(2);
                var expNb = binStr.length-1;
                
                sign = (bignumVal.isNegative()+0)+"";
                exp = new BigNumber(expNb+expOffset, 10).toString(2).lpad("0", expLen);
                var exponentBn = new BigNumber(exp, 2);
                mantissa = binStr.substring(1,binStr.length).rpad("0", mantLen).substr(0, mantLen);
                var mantissaBn = new BigNumber(mantissa, 2);
                
                hexnumVal = new BigNumber(sign+exp+mantissa, 2);
                doubleVal = new BigNumber( (sign == "0") ? 1 : -1 ).times(new BigNumber(2).toPower(exponentBn.minus(expOffset))).times(mantissaBn.times(new BigNumber(2).toPower(-mantLen)).plus(1));
                val.val(doubleVal.toString(10));
            }
            else {
                
                var binStr = bignumVal.toString(2);
                
                if(binStr[0] == "0") {
                    var expNb = -(binStr.indexOf("1")-1);
                }
                else {
                    var expNb = binStr.indexOf(".")-1;
                }
                
                if(expNb > expOffset) {
                    debug(label, "Out of range exponent (too high)");
                    return;
                }
                else if(expNb < 1-expOffset) {
                    
                    /* Denormal number */
                    sign = (bignumVal.isNegative()+0)+"";
                    exp = new BigNumber(0).toString(2).lpad("0", expLen);
                    var binStrDec = binStr.substr(binStr.indexOf(".")+1);
                    mantissa = binStrDec.substr(expOffset-1, mantLen).rpad("0", mantLen);
                    var mantissaBn = new BigNumber(mantissa, 2);
                    
                    hexnumVal = new BigNumber(sign+exp+mantissa, 2);
                    doubleVal = new BigNumber( (sign == "0") ? 1 : -1 ).times(new BigNumber(2).toPower(1-expOffset)).times(mantissaBn.times(new BigNumber(2).toPower(-mantLen)));
                    
                    bignumVal = doubleVal;
                    if(doubleVal.isFinite()) {
                        var nbChar = doubleVal.floor().toString().length-1+doubleVal.decimalPlaces();
                        val.val(doubleVal.toExponential(Math.min(45, nbChar)));
                    }
                    else {
                        val.val(doubleVal.toString());
                    }
                }
                else {
                    sign = (bignumVal.isNegative()+0)+"";
                    exp = new BigNumber(expNb+expOffset, 10).toString(2).lpad("0", expLen);
                    var exponentBn = new BigNumber(exp, 2);
                    
                    var binStrDec = binStr.substr(binStr.indexOf("1")+1).replace('.','');
                    mantissa = binStrDec.rpad("0", mantLen).substr(0, mantLen);
                    var mantissaBn = new BigNumber(mantissa, 2);
                    
                    hexnumVal = new BigNumber(sign+exp+mantissa, 2);
                    doubleVal = new BigNumber( (sign == "0") ? 1 : -1 ).times(new BigNumber(2).toPower(exponentBn.minus(expOffset))).times(mantissaBn.times(new BigNumber(2).toPower(-mantLen)).plus(1));
                    
                    bignumVal = doubleVal;
                    if(doubleVal.isFinite()) {
                        var nbChar = doubleVal.floor().toString().length-1+doubleVal.decimalPlaces();
                        val.val(doubleVal.toExponential(Math.min(45, nbChar)));
                    }
                    else {
                        val.val(doubleVal.toString());
                    }
                }
                
            }
        }
        
        hex.val('0x'+hexnumVal.toString(16).toUpperCase().lpad('0', nbBits/4));
        
        binDiv.html('');
        var binVal = hexnumVal.toString(2).lpad('0', nbBits);
        var container;
        for(var i=nbBits-1; i>=0; i--)
        {
            if((i+1)%8 == 0)
            {
                container = $('<div class="bitsgroup"></div>').appendTo(binDiv);
            }
            $('<span class="binaryBit bit" data-bit="'+i+'">'+binVal.substr(nbBits-1-i,1)+'</span>').appendTo(container);
        }
    }
    
    function selectCrc(desc) {
        $('#crc-degree').val(desc.degree);
        $('#crc-polynomial').val("0x"+Util.getNumberAsHexStr32(desc.polynomial).toUpperCase());
        $('#crc-initial').val("0x"+Util.getNumberAsHexStr32(desc.initial).toUpperCase());
        $('#crc-final').val("0x"+Util.getNumberAsHexStr32(desc.finalXor).toUpperCase());
        $('#crc-ireflected').prop("checked", desc.inputReflected);
        $('#crc-rreflected').prop("checked", desc.resultReflected);
        
        writePolynomial();
    }
    
    function writePolynomial() {
        var polynomial = parseInt($('#crc-polynomial').val(), 16);
        
        var degree = $('#crc-degree').val();
        var str = "x**"+degree;
        for(var i = (degree-1); i >= 0; i--) {
            var mask = (1 << i);
            
            if((polynomial & mask) != 0) {
                str += " + x**"+i;
            }
        }
        
        $('#crc-polynomial-str').text(str);
    }
    
    $('#intInputStr').on('input', handleIntInput);
    $('#integerInput input:radio, #integerInput input:checkbox').on('change', handleIntInput);
    
    
    $('#charInputStr').on('input', handleCharInput);
    $('#characterInput input:radio, #characterInput input:checkbox').on('change', handleCharInput);
    
    $('#floatInputStr').on('input', handleFloatInput);
    $('#floatInput input:radio, #floatInput input:checkbox').on('change', handleFloatInput);
    
    $('body').on('click', 'a.internal-link', function(e){
        var link = $(this).prop('href');
        
        if(link.indexOf('#') != 1)
        {
            e.preventDefault();
            action = link.substr(link.indexOf('#')+1);
            
            debug('Internal link:', action);
            
            switch(action)
            {
                case 'format-help':
                    $(this).find('.glyphicon').removeClass('glyphicon-plus-sign').addClass('glyphicon-minus-sign');
                    $('#format-help .panel-body').show();
                    break;
            }
        }
    });
    
    $('#format-help a#toggle-help').click(function(e){
        e.preventDefault();
        
        $(this).find('.glyphicon').toggleClass('glyphicon-plus-sign').toggleClass('glyphicon-minus-sign');
        $('#format-help .panel-body').toggle();
    });
    
    $('.clear-input').click(function(e){
        e.preventDefault();
        
        $('#'+$(this).data('target')).val('');
        $('#'+$(this).data('target')).trigger('input')
    });
    
    $('input[readonly]').click(function(){
        $(this).select();
    });
    
    $('div.binary').click(function(){
        SelectText(this);
    });
    
    $('#char-wrapper').click(function(){
        SelectText($('#char-value')[0]);
    });
    
    $('.nav a').click(function(e) {
        e.preventDefault();
        
        var types = $(this).data('types');
        
        var History = window.History;
        History.pushState({types: types}, document.title, "?"+types);
    });
    
    function handleState(e)
    {
        var History = window.History;
        var State = History.getState();
        var types = State.data.types;
        
        debug('Change to', types);
        
        $('nav .nav li').removeClass('active');
        $('nav .nav li a[data-types="'+types+'"]').parent().addClass('active');

        
        $('.types:not(#types-'+types+')').hide();
        $('#types-'+types+'.types').show();
        
        $('#types-'+types+'.types .inputStr').focus();
        
        /* If no selection, active integers */
        if($('nav .nav li.active').length == 0)
        {
            debug('Unknown types', types);
            History.replaceState({types: 'integers'}, document.title, "?integers");
        }
    }
        
    $(window).bind( 'statechange', handleState);
    
    /* Init the history state */
    var state = window.History.getState();
    
    if('types' in state.data)
    {
        History.replaceState({types: state.data.types}, document.title, "?"+state.data.types);
        debug('Init to',state.data.types);
        
        handleState()
    }
    else
    {
        var idx = state.hash.indexOf('?');
        if(idx != -1)
        {
            var str = state.hash.substr(idx+1);

            History.replaceState({types: str}, document.title, "?"+str);
            debug('Init to',str);
        }
        else
        {
            History.replaceState({types: 'integers'}, document.title, "?integers");
            debug('No initial state. Default to integers.');
        }
    }
    
    
    $(crcs).each(function(i) {
        var opt = $('<option>').attr('value', i).text(this.name);
        opt.data('desc', this);
        
        $('#predefined-crcs').append(opt);
    });
    
    $('#predefined-crcs').on('change', function(e) {
        
        if(this.value == -1) {
            selectCrc({
                degree: 0,
                polynomial: 0x00,
                initial: 0x00,
                inputReflected: false,
                resultReflected: false,
                finalXor: 0x00
            });
        }
        else {
            selectCrc(crcs[this.value]);
        }
    });
    
    $('#predefined-enable').on('change', function(e) {
        if($(this).is(":checked")) {
            $('#predefined-crcs').prop('disabled', false);
            $('#custom-crc input, #custom-crc select').each(function(){ $(this).prop('disabled', true); });
            $('#custom-crc label').addClass('disabled');
        }
        else {
            $('#predefined-crcs').prop('disabled', true);
            $('#custom-crc input, #custom-crc select').each(function(){ $(this).prop('disabled', false); });
            $('#custom-crc label').removeClass('disabled');
        }
    });
    
    $('#crcDataInput button[type="submit"]').on('click', function(e) {
        e.preventDefault();
        
        crc = new CRC({
            degree: $('#crc-degree').val(),
            polynomial: parseInt($('#crc-polynomial').val(), 16),
            initial: parseInt($('#crc-initial').val(), 16),
            inputReflected: $('#crc-ireflected').is(':checked'),
            resultReflected: $('#crc-rreflected').is(':checked'),
            finalXor: parseInt($('#crc-final').val(), 16)
        });

        var byteArray = Util.hexStringToByteArray($('#crc-data').val().replace(/\s/g, ''));
        
        var crcVal = crc.compute(byteArray);
        $('#crc-result').text("0x"+Util.getNumberAsHexStr32(crcVal).toUpperCase().substr(-$('#crc-degree').val()/4));
    });
    
    $('#crc-polynomial').on('input', writePolynomial);
    
    /* Unit Testing */
    /*var resp = $.get('NB.txt').done(function(data){
        var numbers = data.split("\n");
        for(var i=0; i<numbers.length; i++)
        {
            $('#intInputStr').val(numbers[i]);
            handleIntInput();
            $('#result').val($('#result').val()+$('#uint32-value').val()+' '+$('#uint32-hex').val()+"\n");
        }
    });*/
});

String.prototype.lpad = function(padString, length) {
    var str = this;
    while (str.length < length)
        str = padString + str;
    return str;
}

String.prototype.rpad = function(padString, length) {
    var str = this;
    while (str.length < length)
        str = str + padString;
    return str;
}

function SelectText(text) {
    var doc = document
        , range, selection
    ;    
    if (doc.body.createTextRange) {
        range = document.body.createTextRange();
        range.moveToElementText(text);
        range.select();
    } else if (window.getSelection) {
        selection = window.getSelection();        
        range = document.createRange();
        range.selectNodeContents(text);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}