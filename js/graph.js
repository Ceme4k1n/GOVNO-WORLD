const rootStyles = getComputedStyle(document.documentElement);
  const margin = {
      top: parseInt(rootStyles.getPropertyValue('--margin-top')),
      right: parseInt(rootStyles.getPropertyValue('--margin-right')),
      bottom: parseInt(rootStyles.getPropertyValue('--margin-bottom')),
      left: parseInt(rootStyles.getPropertyValue('--margin-left'))
  };

  const width = parseInt(rootStyles.getPropertyValue('--chart-width')) - margin.left - margin.right;
  const heightSvg = parseInt(rootStyles.getPropertyValue('--chart-height')) - margin.top - margin.bottom;

  const age = userProfileData.profile_age ? parseInt(userProfileData.profile_age) : 25;
  const lifeExpectancy = userProfileData.lifeExpectancy ? parseInt(userProfileData.lifeExpectancy) : 25;
  const toiletVisits = userProfileData.profile_quantity  ? parseInt(userProfileData.profile_quantity ) : 1;  

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
      const weeklyProduction = dailyProduction * 7;
      const monthlyProduction = dailyProduction * 30;
      const yearlyProduction = dailyProduction * 365;

      return [
          { time: "день", amount: dailyProduction / 1000 },
          { time: "неделя", amount: weeklyProduction / 1000 },
          { time: "месяц", amount: monthlyProduction / 1000 },
          { time: "год", amount: yearlyProduction / 1000 }
      ];
  };

  const chartData = calculateData(averageWeight, toiletVisits, age, lifeExpectancy);

  const svg = d3.select("#chart")
      .append("svg")
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${heightSvg + margin.top + margin.bottom}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scalePoint()
      .domain(chartData.map(d => d.time))
      .range([0, width]);

  const maxY = d3.max(chartData, d => d.amount) * 1.1;

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
      .call(xAxis)
      .selectAll("text")
      .attr("class", "axis-text");

  svg.append("g")
      .attr("class", "y-axis")
      .call(yAxis)
      .selectAll("text")
      .attr("class", "axis-text");

  const line = d3.line()
      .x(d => x(d.time))
      .y(d => y(d.amount));

  svg.append("path")
      .datum(chartData)
      .attr("class", "line")
      .attr("d", line);