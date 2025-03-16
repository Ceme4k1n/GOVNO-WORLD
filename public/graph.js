const age = 25;
const lifeExpectancy = 75;
const toiletVisits = 2;

const diet = "мясоед";

let averageWeight;
switch (diet) {
    case "мясоед":
        averageWeight = 250;
        break;
    case "веган":
        averageWeight = 300;
        break;
    case "фастфуд":
        averageWeight = 200;
        break;
    default:
        averageWeight = 250;
}

const calculateData = (averageWeight, toiletVisits, age, lifeExpectancy) => {
    const dailyProduction = averageWeight * toiletVisits;
    const monthlyProduction = dailyProduction * 30;
    const yearlyProduction = dailyProduction * 365;
    const totalLifeProduction = dailyProduction * 365 * (lifeExpectancy - age);

    return [
        { time: "0 день", amount: 0 },
        { time: "1 день", amount: dailyProduction / 1000 },
        { time: "1 месяц", amount: monthlyProduction / 1000 },
        { time: "1 год", amount: yearlyProduction / 1000 },
        { time: "50 лет", amount: totalLifeProduction / 1000 }
    ];
};

const data = calculateData(averageWeight, toiletVisits, age, lifeExpectancy);

const margin = { top: 30, right: 30, bottom: 30, left: 100 };
const width = 800 - margin.left - margin.right;
const heightSvg = 400 - margin.top - margin.bottom;

const svg = d3.select("#chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${heightSvg + margin.top + margin.bottom}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

const x = d3.scalePoint()
    .domain(data.map(d => d.time))
    .range([0, width]);

const maxY = d3.max(data, d => d.amount) * 1.1;

const y = d3.scaleLinear()
    .domain([0, maxY])
    .range([heightSvg, 0]);

const makeYGridlines = () => d3.axisLeft(y).ticks(5);

svg.append("g")
    .attr("class", "grid")
    .call(makeYGridlines()
        .tickSize(-width)
        .tickFormat("")
    );

const xAxis = d3.axisBottom(x);
const yAxis = d3.axisLeft(y)
    .tickFormat(d => `${d} кг`);

svg.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${heightSvg})`)
    .call(xAxis);

svg.append("g")
    .attr("class", "y-axis")
    .call(yAxis);

const line = d3.line()
    .curve(d3.curveCatmullRom.alpha(1.5))
    .x(d => x(d.time))
    .y(d => y(d.amount));

svg.append("path")
    .datum(data)
    .attr("class", "line")
    .attr("d", line);

window.addEventListener('resize', resize);

function resize() {
    const chartWidth = parseInt(d3.select('#chart').style('width'), 10);
    const chartHeight = parseInt(d3.select('#chart').style('height'), 10);

    d3.select('svg')
        .attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`);
}